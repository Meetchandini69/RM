import { Router, type Request, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "./registration";
import { sendAdminTelegram } from "../lib/telegram";

const router = Router();
router.use(cookieParser());
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const options = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/api", maxAge: 7 * 86400000 };
const normalize = (s: string) => s.trim().replace(/^@/, "").replace(/[\s()-]/g, "").toLowerCase();
const attempts = new Map<string, { count: number; until: number }>();
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.path.startsWith("/viewer") || req.method !== "POST") return next();
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const key = `${process.env.API_PROXY_SECRET ? req.get("x-client-ip") || req.ip : req.ip}`;
  const entry = attempts.get(key) || { count: 0, until: now + 900000 };
  attempts.set(key, entry);
  if (++entry.count > 20 || attempts.size > 10000) { res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." }); return; }
  next();
});
export async function approvedViewer(req: Request) {
  const token = req.cookies?.ram_viewer;
  if (typeof token !== "string") return null;
  const row = (await pool.query("SELECT record FROM viewers JOIN viewer_sessions ON viewers.id = viewer_sessions.member WHERE token = $1 AND expires > $2 AND record->>'status' = 'Approved'", [digest(token), Date.now()])).rows[0];
  return row?.record || null;
}
export const requireViewer: RequestHandler = async (req, res, next) => {
  const viewer = await approvedViewer(req);
  if (!viewer) { res.status(403).json({ message: "Register and wait for admin approval, then log in to send interest." }); return; }
  res.locals.viewer = viewer;
  next();
};
router.post("/viewer/register", async (req, res) => {
  const { name, contactType, contact, lookingFor, age, location, password } = req.body;
  if (![name, contact, lookingFor, location, password].every(v => typeof v === "string") || !["telegram", "whatsapp"].includes(contactType)) { res.status(400).json({ message: "Complete all required details." }); return; }
  const normalized = normalize(contact);
  if (!name.trim() || name.length > 100 || !lookingFor.trim() || lookingFor.length > 500 || !location.trim() || location.length > 150 || !Number.isInteger(age) || age < 18 || age > 100 || password.length < 8 || password.length > 128 || !(contactType === "telegram" ? /^[a-z][a-z0-9_]{4,31}$/ : /^\+[1-9]\d{7,14}$/).test(normalized)) { res.status(400).json({ message: "Enter valid details, age 18–100, a Telegram username or WhatsApp number with country code, and a password of 8–128 characters." }); return; }
  const record = { id: randomUUID(), name: name.trim(), contactType, contact: normalized, lookingFor: lookingFor.trim(), age, location: location.trim(), status: "Pending approval", submittedAt: new Date().toISOString(), notificationStatus: "Not sent" };
  const salt = randomBytes(16).toString("hex");
  const result = await pool.query("INSERT INTO viewers VALUES ($1, $2, $3, $4) ON CONFLICT(contact) DO NOTHING RETURNING id", [record.id, normalized, `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, JSON.stringify(record)]);
  if (!result.rows.length) { res.status(409).json({ message: "These contact details are already registered. Please log in after approval." }); return; }
  try {
    await sendAdminTelegram(`New browsing registration\nName: ${record.name}\n${contactType}: ${normalized}\nLooking for: ${record.lookingFor}\nAge: ${age}\nLocation: ${record.location}\nReview in /admin/registration`);
    record.notificationStatus = "Sent";
  } catch { record.notificationStatus = "Failed"; }
  await pool.query("UPDATE viewers SET record = jsonb_set(record, '{notificationStatus}', to_jsonb($1::text)) WHERE id = $2", [record.notificationStatus, record.id]);
  res.status(201).json({ message: "Registration submitted. Once admin approves, log in with your Telegram username or WhatsApp number and password." });
});
router.post("/viewer/login", async (req, res) => {
  const { contact, password } = req.body;
  if (typeof contact !== "string" || typeof password !== "string" || password.length > 128 || contact.length > 64) { res.status(400).json({ message: "Enter your contact and password." }); return; }
  const row = (await pool.query("SELECT * FROM viewers WHERE contact = $1", [normalize(contact)])).rows[0];
  const [salt, hash] = (row?.password || "invalid:" + "00".repeat(64)).split(":");
  if (!timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex")) || !row) { res.status(401).json({ message: "Contact or password is incorrect." }); return; }
  if (row.record.status !== "Approved") { res.status(403).json({ message: row.record.status === "Rejected" ? "Your registration was not approved. Please contact the team." : "Your registration is awaiting admin approval." }); return; }
  const token = randomBytes(32).toString("hex");
  await pool.query("DELETE FROM viewer_sessions WHERE expires < $1", [Date.now()]);
  await pool.query("INSERT INTO viewer_sessions VALUES ($1, $2, $3)", [digest(token), row.id, Date.now() + options.maxAge]);
  res.cookie("ram_viewer", token, options).json(row.record);
});
router.get("/viewer/me", async (req, res) => res.json(await approvedViewer(req)));
router.post("/viewer/logout", async (req, res) => {
  if (typeof req.cookies?.ram_viewer === "string") await pool.query("DELETE FROM viewer_sessions WHERE token = $1", [digest(req.cookies.ram_viewer)]);
  res.clearCookie("ram_viewer", options).json({ success: true });
});
router.get("/registration/admin/viewers", requireAdmin, async (_req, res) => res.json((await pool.query("SELECT record FROM viewers ORDER BY record->>'submittedAt' DESC")).rows.map(r => r.record)));
router.post("/registration/admin/viewers/:id/review", requireAdmin, async (req, res) => {
  if (!["Approved", "Rejected"].includes(req.body.status)) { res.status(400).json({ message: "Choose approve or reject." }); return; }
  const result = await pool.query("UPDATE viewers SET record = jsonb_set(record, '{status}', to_jsonb($1::text)) WHERE id = $2 RETURNING record", [req.body.status, req.params.id]);
  if (!result.rows.length) { res.status(404).json({ message: "Registration not found." }); return; }
  if (req.body.status === "Rejected") await pool.query("DELETE FROM viewer_sessions WHERE member = $1", [req.params.id]);
  res.json(result.rows[0].record);
});
export default router;
