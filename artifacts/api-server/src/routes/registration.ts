import { activeMembership } from "../lib/member-access";
import { Router } from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { sendAdminTelegram } from "../lib/telegram";
import {
  RegisterProfileBody,
  LoginRegistrationBody,
  LoginRegistrationAdminBody,
  UpdateRegistrationSettingsBody,
  ReviewRegistrationBody,
  type RegistrationRecord,
  type RegistrationSettings,
} from "@workspace/api-zod";

const router = Router();
router.use(cookieParser());
const derive = promisify(scrypt);
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/registration",
  maxAge: 7 * 86400000,
};
const attempts = new Map<string, { count: number; until: number }>();
router.use((req, res, next) => {
  if (req.method !== "POST" && req.method !== "PUT") return next();
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  const clientIp = process.env.API_PROXY_SECRET
    ? req.get("x-client-ip") || req.ip
    : req.ip;
  const key = `${clientIp || "unknown"}:${req.path}`;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
  if (++entry.count > 20 || attempts.size > 10000) {
    res
      .status(429)
      .json({ message: "Too many attempts. Please try again in 15 minutes." });
    return;
  }
  attempts.set(key, entry);
  next();
});

export function recordView(record: RegistrationRecord): RegistrationRecord {
  if (["weekly", "monthly"].includes(record.listing)) record = { ...record, listing: "free", listingPrice: 0 };
  if (record.listing === ("halfyearly" as string)) record = { ...record, listing: "quarterly" };
  const missing: string[] = [];
  if (
    !record.headline.trim() ||
    !record.about.trim() ||
    !record.interests.length ||
    !record.languages.length
  )
    missing.push("About You");
  if (
    ![record.country, record.state, record.city, record.area].every((value) =>
      value.trim(),
    )
  )
    missing.push("Location");
  if (!record.photos.length || !record.photos[record.mainPhoto])
    missing.push("Photos");
  if (!record.preferences.length || !record.availability.length)
    missing.push("Preferences");
  if (!["free", "quarterly", "yearly"].includes(record.listing))
    missing.push("Listing Plan");
  if (!record.accurate || !record.terms || !record.adult)
    missing.push("Review");
  const status =
    record.reviewStatus === "Submitted"
      ? "Pending approval"
      : record.reviewStatus;
  return {
    ...record,
    reviewStatus: status,
    isComplete: !missing.length,
    isPublished: status === "Approved" && !missing.length,
    missingSteps: missing,
    publicSlug: `member-${record.id}`,
    notificationStatus: record.notificationStatus || "Not sent",
  };
}

export const requireAdmin: import("express").RequestHandler = async (
  req,
  res,
  next,
) => {
  const token = req.cookies?.ram_admin;
  if (
    typeof token !== "string" ||
    !(
      await pool.query(
        "SELECT token FROM registration_admin_sessions WHERE token = $1 AND expires > $2",
        [digest(token), Date.now()],
      )
    ).rows[0]
  ) {
    res.status(401).json({ message: "Please sign in as admin." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
};

router.get(
  "/registration/admin/registrations",
  requireAdmin,
  async (_req, res) => {
    const records = (
      await pool.query(
        "SELECT record::text AS record FROM registrations ORDER BY public_id DESC",
      )
    ).rows;
    res.json(
      records.map((row) => recordView(JSON.parse(row.record as string))),
    );
  },
);
const reviewsInProgress = new Set<string>();
router.post(
  "/registration/admin/registrations/:id/review",
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = ReviewRegistrationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Choose approve or reject." });
      return;
    }
    if (reviewsInProgress.has(id)) {
      res
        .status(409)
        .json({ message: "This review is already being processed." });
      return;
    }
    reviewsInProgress.add(id);
    try {
      const row = (
        await pool.query(
          "SELECT record::text AS record FROM registrations WHERE id = $1",
          [id],
        )
      ).rows[0];
      if (!row) {
        res.status(404).json({ message: "Registration not found." });
        return;
      }
      let record = recordView(JSON.parse(row.record));
      if (parsed.data.action === "reject" && ["Profile pending", "Profile rejected"].includes(record.reviewStatus)) {
        const result = await pool.query("UPDATE registrations SET record = jsonb_set(record, '{reviewStatus}', '\"Profile rejected\"') WHERE id = $1 RETURNING record::text AS record", [id]);
        res.json(recordView(JSON.parse(result.rows[0].record)));
        return;
      }
      if (parsed.data.action === "approve" && record.reviewStatus.startsWith("Profile") && (!record.isComplete || !(await activeMembership(record.id)))) {
        res.status(400).json({ message: "An active paid membership and completed profile are required before publication." }); return;
      }
      if (parsed.data.action === "reject") {
        const result = await pool.query(
          "UPDATE registrations SET record = record || jsonb_build_object('reviewStatus', 'Rejected', 'notificationStatus', 'Not sent') WHERE id = $1 RETURNING record::text AS record",
          [id],
        );
        await pool.query(
          "DELETE FROM registration_sessions WHERE member = $1",
          [id],
        );
        res.json(recordView(JSON.parse(result.rows[0].record)));
        return;
      }
      if (
        record.reviewStatus === "Approved" &&
        record.notificationStatus === "Sent"
      ) {
        res.json(record);
        return;
      }
      const approved = await pool.query(
        "UPDATE registrations SET record = record || jsonb_build_object('reviewStatus', 'Approved', 'notificationStatus', 'Sending') WHERE id = $1 RETURNING record::text AS record",
        [id],
      );
      record = recordView(JSON.parse(approved.rows[0].record));
      let notificationStatus = "Sent";
      try {
        await sendAdminTelegram(
          `Profile approved\n\nName: ${record.displayName}\nRegistration: ${record.id}\nPlan: ${record.listing}\nThe member can now log in with their registered password.\n${record.isComplete ? "Profile complete and visible on the website." : "Completed profile details require another admin review before publication."}`,
        );
      } catch {
        notificationStatus = "Failed";
      }
      await pool.query(
        "UPDATE registrations SET record = record || jsonb_build_object('notificationStatus', $1::text) WHERE id = $2 AND record->>'reviewStatus' = 'Approved'",
        [notificationStatus, id],
      );
      const latest = (
        await pool.query(
          "SELECT record::text AS record FROM registrations WHERE id = $1",
          [id],
        )
      ).rows[0];
      res.json(recordView(JSON.parse(latest.record)));
    } finally {
      reviewsInProgress.delete(id);
    }
  },
);

export async function getRegisteredPublicProfiles() {
  const rows = (
    await pool.query(
      "SELECT public_id AS \"publicId\", record::text AS record FROM registrations WHERE record->>'reviewStatus' = 'Approved'",
    )
  ).rows;
  const boosted = new Set((await pool.query("SELECT member FROM profile_boosts WHERE status = 'Approved' AND expires > now()")).rows.map(row => row.member));
  return rows.flatMap((row) => {
    const record = recordView(JSON.parse(row.record as string));
    if (!record.isPublished || !boosted.has(record.id)) return [];
    const citySlug = record.city
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return [
      {
        id: 1000000 + Number(row.publicId),
        slug: record.publicSlug!,
        displayName: record.displayName,
        age: record.age,
        city: record.city,
        citySlug,
        headline: record.headline,
        imageUrl: `/api/member-photos/${record.id}/${record.mainPhoto}`,
        interests: record.interests,
        lookingFor: record.preferences,
        isVerified: false,
        isPremium: boosted.has(record.id),
        isFeatured: true,
        isOnline: false,
        lastActive: "Registered member",
        favouriteCount: 0,
        bio: record.about,
        gallery: record.photos.map(
          (_, index) => `/api/member-photos/${record.id}/${index}`,
        ),
        availability:
          record.status === "available"
            ? record.availability.join(", ")
            : "Temporarily unavailable",
        responseTime: "Response time not yet available",
      },
    ];
  });
}
router.get("/member-photos/:id/:index", async (req, res) => {
  const row = (
    await pool.query(
      "SELECT record::text AS record FROM registrations WHERE id = $1",
      [String(req.params.id)],
    )
  ).rows[0];
  const record = row ? recordView(JSON.parse(row.record as string)) : undefined;
  const index = Number(req.params.index);
  const photo = Number.isInteger(index) ? record?.photos[index] : undefined;
  if (!record?.isPublished || !photo || !(await activeMembership(record.id))) {
    res.sendStatus(404);
    return;
  }
  const [metadata, base64] = photo.dataUrl.split(",");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type(metadata.slice(5).split(";")[0]).send(Buffer.from(base64, "base64"));
});
export async function settings() {
  const stored = (
    await pool.query(
      "SELECT value::text AS value FROM registration_settings WHERE id = 1",
    )
  ).rows[0];
  if (stored) return JSON.parse(stored.value as string) as RegistrationSettings;
  return {
    plans: (["quarterly", "yearly"] as const).map((id) => {
      const raw = { quarterly: "499", yearly: "999" }[id];
      const price = Number(raw);
      return {
        id,
        price: raw && Number.isFinite(price) && price > 0 ? price : 0,
        enabled: !!raw && Number.isFinite(price) && price > 0,
      };
    }),
    termsUrl: process.env.REGISTRATION_TERMS_URL || "/terms",
    privacyUrl: process.env.REGISTRATION_PRIVACY_URL || "/privacy",
  };
}
router.get("/registration/settings", async (_req, res) =>
  res.json(await settings()),
);
router.get("/registration/admin/session", requireAdmin, async (_req, res) => {
  res.json(await settings());
});
router.post("/registration/admin/logout", async (req, res) => {
  const token = req.cookies?.ram_admin;
  if (typeof token === "string") {
    await pool.query("DELETE FROM registration_admin_sessions WHERE token = $1", [digest(token)]);
  }
  res.clearCookie("ram_admin", cookieOptions);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true });
});
router.post("/registration/admin/login", async (req, res) => {
  const parsed = LoginRegistrationAdminBody.safeParse(req.body);
  const secret = process.env.REGISTRATION_ADMIN_PASSWORD;
  if (!secret) {
    res.status(503).json({
      message:
        "Set REGISTRATION_ADMIN_PASSWORD in the API .env to enable admin access.",
    });
    return;
  }
  if (
    !parsed.success ||
    !timingSafeEqual(
      Buffer.from(digest(parsed.data.password)),
      Buffer.from(digest(secret)),
    )
  ) {
    res.status(401).json({ message: "Incorrect admin password." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "DELETE FROM registration_admin_sessions WHERE expires < $1",
    [Date.now()],
  );
  await pool.query("INSERT INTO registration_admin_sessions VALUES ($1, $2)", [
    digest(token),
    Date.now() + 3600000,
  ]);
  res.cookie("ram_admin", token, { ...cookieOptions, maxAge: 3600000 });
  res.json(await settings());
});
router.put("/registration/admin/settings", async (req, res) => {
  const token = req.cookies?.ram_admin;
  if (
    typeof token !== "string" ||
    !(
      await pool.query(
        "SELECT token FROM registration_admin_sessions WHERE token = $1 AND expires > $2",
        [digest(token), Date.now()],
      )
    ).rows[0]
  ) {
    res.status(401).json({ message: "Please sign in as admin." });
    return;
  }
  const parsed = UpdateRegistrationSettingsBody.safeParse(req.body);
  if (
    !parsed.success ||
    parsed.data.plans.length !== 2 ||
    new Set(parsed.data.plans.map((p) => p.id)).size !== 2 ||
    parsed.data.plans.some(
      (p) =>
        !Number.isFinite(p.price) ||
        p.price > 1000000 ||
        (p.enabled && p.price <= 0),
    )
  ) {
    res
      .status(400)
      .json({ message: "Provide valid prices for both paid plans." });
    return;
  }
  for (const url of [parsed.data.termsUrl, parsed.data.privacyUrl]) {
    if (!(/^\/(?!\/)[^\s\\]*$/.test(url) || /^https:\/\/[^\s]+$/.test(url))) {
      res.status(400).json({
        message: "Policy links must be a local path or an HTTPS URL.",
      });
      return;
    }
  }
  await pool.query(
    "INSERT INTO registration_settings VALUES (1, $1) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
    [JSON.stringify(parsed.data)],
  );
  res.json(parsed.data);
});
async function session(member: string, res: import("express").Response) {
  const token = randomBytes(32).toString("hex");
  await pool.query("DELETE FROM registration_sessions WHERE expires < $1", [
    Date.now(),
  ]);
  await pool.query("INSERT INTO registration_sessions VALUES ($1, $2, $3)", [
    digest(token),
    member,
    Date.now() + cookieOptions.maxAge,
  ]);
  res.cookie("ram_session", token, cookieOptions);
}
async function notifyRegistration(record: RegistrationRecord) {
  let status = "Sent";
  try {
    await sendAdminTelegram(`${record.reviewStatus === "Profile pending" ? "Profile details submitted for review" : "New registration"}\n\nName: ${record.displayName}\nRegistration: ${record.id}\nEmail: ${record.email}\nMobile: ${record.mobile}\nAge: ${record.age}\nLocation: ${[record.city, record.state, record.country].filter(Boolean).join(', ')}\nPlan: ${record.listing === 'quarterly' ? 'Quarterly' : record.listing === 'yearly' ? 'Annual' : 'Account only - membership not selected'}\nPrice: INR ${record.listingPrice}\nReview in /admin/registration`);
  } catch { status = "Failed"; }
  await pool.query("UPDATE registrations SET record = jsonb_set(record, '{notificationStatus}', to_jsonb($1::text)) WHERE id = $2 AND record->>'reviewStatus' = $3", [status, record.id, record.reviewStatus]);
  return status;
}
router.post('/registration/admin/registrations/:id/notify', requireAdmin, async (req, res) => {
  const row = (await pool.query('SELECT record FROM registrations WHERE id=$1', [String(req.params.id)])).rows[0];
  if (!row) { res.status(404).json({message:'Registration not found.'}); return; }
  const record = recordView(row.record);
  const notificationStatus = await notifyRegistration(record);
  res.json({notificationStatus});
});
const saveRegistration: import("express").RequestHandler = async (req, res) => {
  let existing: RegistrationRecord | undefined;
  if (req.method === "PUT") {
    const token = req.cookies?.ram_session;
    const row =
      typeof token === "string"
        ? (
            await pool.query(
              "SELECT record::text AS record FROM registrations JOIN registration_sessions ON registrations.id = registration_sessions.member WHERE token = $1 AND expires > $2",
              [digest(token), Date.now()],
            )
          ).rows[0]
        : undefined;
    if (!row) {
      res
        .status(401)
        .json({ message: "Please log in to complete your profile." });
      return;
    }
    existing = recordView(JSON.parse(row.record as string));
    if (!["Approved", "Profile pending", "Profile rejected"].includes(existing.reviewStatus)) {
      res.status(403).json({
        message:
          "Your registration must be approved before you can edit your profile.",
      });
      return;
    }
    req.body = {
      ...req.body,
      password: "unchanged-password",
      confirmPassword: "unchanged-password",
    };
  }
  if (!existing) {
    const basic = req.body || {};
    req.body = { displayName: basic.displayName, dateOfBirth: basic.dateOfBirth, age: basic.age, email: basic.email, mobile: basic.mobile, password: basic.password, confirmPassword: basic.confirmPassword,
      headline: '', about: '', interests: [], languages: [], country: '', state: '', city: '', area: '', pinCode: '', photos: [], mainPhoto: 0,
      preferences: [], minAge: 18, maxAge: 100, availability: [], status: 'available', listing: 'free', partnerOptIn: false,
      accurate: basic.accurate, terms: basic.terms, adult: basic.adult };
  } else {
    const membership = await activeMembership(existing.id);
    if (!membership) { res.status(403).json({message:'Upgrade your plan and wait for payment confirmation to complete your profile.'}); return; }
    req.body.listing = membership.plan === 'yearly' ? 'yearly' : 'quarterly';
  }
  const parsed = RegisterProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Please complete all required profile details.",
      field: parsed.error.issues[0]?.path[0],
    });
    return;
  }
  const data = parsed.data;
  const fail = (field: string, message: string) => {
    res.status(400).json({ field, message });
  };
  const dob = new Date(`${data.dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let actualAge = now.getUTCFullYear() - dob.getUTCFullYear();
  if (
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() < dob.getUTCDate())
  )
    actualAge--;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth) ||
    !Number.isFinite(dob.getTime()) ||
    dob.toISOString().slice(0, 10) !== data.dateOfBirth ||
    actualAge < 18 ||
    actualAge > 100 ||
    actualAge !== data.age
  )
    return fail(
      "dateOfBirth",
      "Enter a valid date of birth and matching age. Registration is for adults aged 18 or older.",
    );
  if (data.password !== data.confirmPassword)
    return fail("confirmPassword", "Passwords do not match.");
  const email = data.email.trim().toLowerCase();
  const mobile = data.mobile.replace(/[\s()-]/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail("email", "Enter a valid email address.");
  if (!/^\+[1-9]\d{7,14}$/.test(mobile))
    return fail(
      "mobile",
      "Include your country code, for example +919876543210.",
    );
  for (const field of [
    "displayName",
    "headline",
    "about",
    "country",
    "state",
    "city",
    "area",
  ] as const) {
    data[field] = data[field].trim();
    if (field === "displayName" && !data[field])
      return fail(field, "This field is required.");
  }
  if (
    data.minAge > data.maxAge ||
    !Number.isInteger(data.minAge) ||
    !Number.isInteger(data.maxAge)
  )
    return fail("minAge", "Enter a valid age range starting at 18 or older.");
  if (
    !Number.isInteger(data.mainPhoto) ||
    (data.photos.length > 0 && !data.photos[data.mainPhoto])
  )
    return fail("photos", "Select a main profile photo.");
  for (const photo of data.photos) {
    const match =
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        photo.dataUrl,
      );
    if (!match) return fail("photos", "Upload JPEG, PNG or WebP photos only.");
    const bytes = Buffer.from(match[2], "base64");
    const valid =
      match[1] === "jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : match[1] === "png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid || bytes.length > 1100000)
      return fail(
        "photos",
        "A photo is invalid or too large. Please upload it again.",
      );
  }
  if (!data.accurate || !data.terms || !data.adult)
    return fail(
      "confirmations",
      "Please accept all three required confirmations.",
    );
  const plan = (await settings()).plans.find((p) => p.id === data.listing);
  if (existing && !["quarterly", "yearly"].includes(data.listing))
    return fail(
      "listing",
      "Choose an available Quarterly or Annual plan to register.",
    );
  const duplicate = (
    await pool.query(
      "SELECT email, mobile FROM registrations WHERE (email = $1 OR mobile = $2) AND id != $3",
      [email, mobile, existing?.id || ""],
    )
  ).rows[0];
  if (duplicate) {
    res.status(409).json({
      field: duplicate.email === email ? "email" : "mobile",
      message:
        "An account with these contact details already exists. Please log in.",
    });
    return;
  }
  const salt = randomBytes(16).toString("hex");
  const hash = existing
    ? ""
    : ((await derive(data.password, salt, 64)) as Buffer).toString("hex");
  const { password: _password, confirmPassword: _confirm, ...details } = data;
  let record: RegistrationRecord = {
    ...details,
    email,
    mobile,
    id: existing?.id || randomUUID(),
    submittedAt: existing?.submittedAt || new Date().toISOString(),
    reviewStatus: existing?.reviewStatus || "Pending approval",
    notificationStatus: existing?.notificationStatus || "Not sent",
    listingPrice: plan?.price || 0,
  };
  try {
    if (existing) {
      const result = await pool.query(
        "UPDATE registrations SET email = $1, mobile = $2, record = $3::jsonb || jsonb_build_object('reviewStatus', 'Profile pending', 'notificationStatus', 'Not sent') WHERE id = $4 AND record->>'reviewStatus' IN ('Approved', 'Profile pending', 'Profile rejected') RETURNING record::text AS record",
        [email, mobile, JSON.stringify(record), existing.id],
      );
      if (!result.rows[0]) {
        res
          .status(403)
          .json({
            message: "Your approval has changed. Please contact the team.",
          });
        return;
      }
      record = recordView(JSON.parse(result.rows[0].record));
    } else
      await pool.query(
        "INSERT INTO registrations (id, email, mobile, password, record) VALUES ($1, $2, $3, $4, $5)",
        [record.id, email, mobile, `${salt}:${hash}`, JSON.stringify(record)],
      );
  } catch {
    res.status(409).json({
      message:
        "Unable to save your profile. An account may already exist with these details.",
    });
    return;
  }
  if (existing) {
    await session(record.id, res);

  }
  else res.clearCookie("ram_session", { path: cookieOptions.path });
  record.notificationStatus = await notifyRegistration(record);
  res.json(recordView(record));
};
router.post("/registrations", saveRegistration);
router.put("/registration/profile", saveRegistration);
router.get("/registration/me", async (req, res) => {
  const token = req.cookies?.ram_session;
  const row =
    typeof token === "string"
      ? (
          await pool.query(
            "SELECT record::text AS record FROM registrations JOIN registration_sessions ON registrations.id = registration_sessions.member WHERE token = $1 AND expires > $2",
            [digest(token), Date.now()],
          )
        ).rows[0]
      : undefined;
  res.setHeader("Cache-Control", "no-store");
  if (!row) {
    res
      .status(401)
      .json({ message: "Please log in to view your submitted profile." });
    return;
  }
  const record = recordView(JSON.parse(row.record as string));
  if (!["Approved", "Profile pending", "Profile rejected"].includes(record.reviewStatus)) {
    res.status(403).json({
      message:
        "Your registration is awaiting admin approval. Login will be available after approval.",
    });
    return;
  }
  res.json(record);
});
router.post("/registration/login", async (req, res) => {
  const parsed = LoginRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Enter your email and password." });
    return;
  }
  const row = (
    await pool.query(
      "SELECT id, password, record::text AS record FROM registrations WHERE email = $1",
      [parsed.data.email.trim().toLowerCase()],
    )
  ).rows[0];
  const [salt, hash] = (
    (row?.password as string) || "invalid:" + "00".repeat(64)
  ).split(":");
  const candidate = (await derive(parsed.data.password, salt, 64)) as Buffer;
  if (!row || !timingSafeEqual(candidate, Buffer.from(hash, "hex"))) {
    res.status(401).json({ message: "Email or password is incorrect." });
    return;
  }
  const record = recordView(JSON.parse(row.record as string));
  if (!["Approved", "Profile pending", "Profile rejected"].includes(record.reviewStatus)) {
    res.status(403).json({
      message:
        record.reviewStatus === "Rejected"
          ? "Your registration was not approved. Please contact the team."
          : "Your registration is awaiting admin approval. Please log in after approval.",
    });
    return;
  }
  await session(row.id as string, res);
  res.json(record);
});
export default router;
