import test from "node:test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const { Pool } = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
)("pg");
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";

test("registration, private access, admin persistence, and Telegram delivery", async () => {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error(
      "Set TEST_DATABASE_URL to a local PostgreSQL test server connection.",
    );
  const adminUrl = new URL(process.env.TEST_DATABASE_URL);
  if (!["127.0.0.1", "localhost"].includes(adminUrl.hostname))
    throw new Error(
      "Smoke tests create/drop their own databases and must use a local PostgreSQL server.",
    );
  const testDb = "ram_test_" + randomUUID().replaceAll("-", "");
  const adminPool = new Pool({ connectionString: adminUrl.href });
  await adminPool.query(
    "CREATE DATABASE " + testDb + " ENCODING 'UTF8' TEMPLATE template0",
  );
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = "/" + testDb;
  const proxySecret = "test-proxy-secret-at-least-32-characters";
  const directory = await mkdtemp(
    path.join(tmpdir(), "ram-registration-test-"),
  );
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  // Only the test server sees this mock; no real Telegram messages are sent.
  const mock = `globalThis.fetch = async (url, options) => {
    if (!url.startsWith('https://api.telegram.org/bottest-token/')) throw new Error('Unexpected external request');
    const body = JSON.parse(options.body);
    if ((!body.text.includes('Reply via ') && !body.text.startsWith('Profile approved')) || body.chat_id !== 'test-chat') throw new Error('Invalid admin notification');
    if (body.text.includes('Test-password')) throw new Error('Password leaked');
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.TEST_TELEGRAM_LOG, JSON.stringify(body) + String.fromCharCode(10));
    return new Response(JSON.stringify({ok: !body.text.includes('simulate failure')}), {status: 200});
  };`;
  let child;
  const start = async (telegramToken = "test-token") => {
    child = spawn(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(mock)}`,
        "dist/index.mjs",
      ],
      {
        cwd: path.resolve("artifacts/api-server"),
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: "production",
          DATABASE_URL: databaseUrl.href,
          API_PROXY_SECRET: proxySecret,
          REGISTRATION_ADMIN_PASSWORD: "test-admin-password",
          TELEGRAM_BOT_TOKEN: telegramToken,
          TELEGRAM_CHAT_ID: "test-chat",
          TEST_TELEGRAM_LOG: path.join(directory, "telegram.jsonl"),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Test API did not start")),
        10000,
      );
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Test API exited: ${code}`));
      });
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Server listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  };
  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      child.kill();
    });
  const request = async (
    route,
    data,
    cookie,
    method = data ? "POST" : "GET",
  ) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${route}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-proxy-secret": proxySecret,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const photo = await readFile(
    "artifacts/him-for-you/public/assets/rahul-profile.jpg",
  );
  const dob = new Date();
  dob.setUTCFullYear(dob.getUTCFullYear() - 25);
  const input = {
    displayName: "Test Member",
    age: 25,
    dateOfBirth: dob.toISOString().slice(0, 10),
    email: "test@example.invalid",
    mobile: "+919999999991",
    password: "Test-password-123",
    confirmPassword: "Test-password-123",
    headline: "A friendly introduction",
    about: "I enjoy travel, conversation and meeting new people.",
    country: "India",
    state: "Tamil Nadu",
    city: "Coimbatore",
    area: "Central",
    pinCode: "",
    interests: ["Friendship"],
    languages: ["English"],
    preferences: ["Friendship"],
    availability: ["Weekends"],
    minAge: 18,
    maxAge: 50,
    status: "available",
    listing: "free",
    partnerOptIn: false,
    accurate: true,
    terms: true,
    adult: true,
    photos: [
      {
        dataUrl: `data:image/jpeg;base64,${photo.toString("base64")}`,
        category: "profile",
      },
    ],
    mainPhoto: 0,
  };
  try {
    await start();
    const publicCount = (await request("/profiles")).body.length;
    assert.equal(
      (await request("/registration/admin/registrations")).status,
      401,
    );
    assert.equal((await request("/registration/me")).status, 401);
    for (const invalid of [
      { mobile: "123" },
      { age: 17 },
      { confirmPassword: "wrong" },
      { mainPhoto: 2 },
      { terms: false },
      { minAge: 60, maxAge: 30 },
      {
        photos: [
          { dataUrl: "data:image/jpeg;base64,YmFk", category: "profile" },
        ],
      },
    ]) {
      assert.equal(
        (await request("/registrations", { ...input, ...invalid })).status,
        400,
      );
    }
    const saved = await request("/registrations", {
      ...input,
      reviewStatus: "Approved",
      isPublished: true,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.reviewStatus, "Pending approval");
    assert.equal(saved.body.isPublished, false);
    assert.equal(saved.body.password, undefined);
    assert.equal(
      (await request("/registration/me", undefined, saved.cookie)).status,
      401,
    );
    assert.equal(
      (
        await request("/registration/login", {
          email: input.email,
          password: input.password,
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(`/profiles/${saved.body.publicSlug}`)).status,
      404,
    );
    assert.equal((await request("/profiles")).body.length, publicCount);
    const duplicate = await request("/registrations", {
      ...input,
      email: "other@example.invalid",
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.field, "mobile");
    const reviewPath = `/registration/admin/registrations/${saved.body.id}/review`;
    assert.equal(
      (await request(reviewPath, { action: "approve" })).status,
      401,
    );
    const admin = await request("/registration/admin/login", {
      password: "test-admin-password",
    });
    assert.equal(admin.status, 200);
    assert.equal((await request("/registration/admin/session")).status, 401);
    assert.equal((await request("/registration/admin/session", undefined, admin.cookie)).status, 200);
    assert.equal((await request("/registration/admin/login", { password: "incorrect" })).status, 401);
    const queue = await request(
      "/registration/admin/registrations",
      undefined,
      admin.cookie,
    );
    assert.equal(queue.body[0].id, saved.body.id);
    assert.equal(JSON.stringify(queue.body).includes("password"), false);
    const approved = await request(
      reviewPath,
      { action: "approve" },
      admin.cookie,
    );
    assert.equal(approved.body.reviewStatus, "Approved");
    assert.equal(approved.body.notificationStatus, "Sent");
    assert.equal(approved.body.isPublished, true);
    const sentLog = await readFile(
      path.join(directory, "telegram.jsonl"),
      "utf8",
    );
    await request(reviewPath, { action: "approve" }, admin.cookie);
    assert.equal(
      await readFile(path.join(directory, "telegram.jsonl"), "utf8"),
      sentLog,
    );
    const login = await request("/registration/login", {
      email: input.email,
      password: input.password,
    });
    assert.equal(login.status, 200);
    assert.equal(
      (await request("/registration/me", undefined, login.cookie)).body.id,
      saved.body.id,
    );
    const publicProfile = await request(`/profiles/${saved.body.publicSlug}`);
    assert.equal(publicProfile.status, 200);
    for (const field of [
      "email",
      "mobile",
      "dateOfBirth",
      "password",
      "partnerOptIn",
    ])
      assert.equal(publicProfile.body[field], undefined);
    assert.equal(publicProfile.body.isPremium, false);
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${port}${publicProfile.body.imageUrl}`, {
          headers: { "x-api-proxy-secret": proxySecret },
        })
      ).status,
      200,
    );
    assert.equal((await request("/profiles")).body.length, publicCount + 1);
    const config = admin.body;
    config.plans[0].price = 777;
    assert.equal(
      (await request("/registration/admin/settings", config, undefined, "PUT"))
        .status,
      401,
    );
    assert.equal(
      (
        await request(
          "/registration/admin/settings",
          config,
          admin.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    const basicOnly = {
      ...input,
      displayName: "Basic Member",
      email: "basic@example.invalid",
      mobile: "+919999999994",
      headline: "",
      about: "",
      country: "",
      state: "",
      city: "",
      area: "",
      interests: [],
      languages: [],
      preferences: [],
      availability: [],
      photos: [],
    };
    const partial = await request("/registrations", basicOnly);
    assert.equal(partial.status, 200);
    const partialReview = `/registration/admin/registrations/${partial.body.id}/review`;
    const partialApproved = await request(
      partialReview,
      { action: "approve" },
      admin.cookie,
    );
    assert.equal(partialApproved.body.isPublished, false);
    assert.ok(partialApproved.body.missingSteps.includes("Photos"));
    const partialLogin = await request("/registration/login", {
      email: basicOnly.email,
      password: basicOnly.password,
    });
    assert.equal(partialLogin.status, 200);
    assert.equal(
      (await request("/registration/profile", partial.body, undefined, "PUT"))
        .status,
      401,
    );
    assert.equal(
      (await request(`/profiles/${partial.body.publicSlug}`)).status,
      404,
    );
    const completed = await request(
      "/registration/profile",
      {
        ...partial.body,
        ...input,
        email: basicOnly.email,
        mobile: basicOnly.mobile,
        listing: "weekly",
        listingPrice: 1,
        reviewStatus: "Rejected",
      },
      partialLogin.cookie,
      "PUT",
    );
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.reviewStatus, "Approved");
    assert.equal(completed.body.isPublished, true);
    assert.equal(completed.body.listingPrice, 777);
    assert.equal(completed.body.id, partial.body.id);
    assert.equal(
      (await request(`/profiles/${partial.body.publicSlug}`)).body.isPremium,
      false,
    );
    // Server independently removes incomplete profiles even if UI validation is bypassed.
    const incomplete = await request(
      "/registration/profile",
      { ...completed.body, about: "" },
      partialLogin.cookie,
      "PUT",
    );
    assert.equal(incomplete.body.isPublished, false);
    assert.equal(
      (await request(`/profiles/${partial.body.publicSlug}`)).status,
      404,
    );
    await request(
      "/registration/profile",
      completed.body,
      partialLogin.cookie,
      "PUT",
    );
    await stop();
    await start();
    assert.equal(
      (await request("/registration/settings")).body.plans[0].price,
      777,
    );
    assert.equal(
      (await request("/registration/me", undefined, partialLogin.cookie)).body
        .isPublished,
      true,
    );
    const rejected = await request(
      partialReview,
      { action: "reject" },
      admin.cookie,
    );
    assert.equal(rejected.body.reviewStatus, "Rejected");
    assert.equal(
      (await request("/registration/me", undefined, partialLogin.cookie))
        .status,
      401,
    );
    assert.equal(
      (
        await request("/registration/login", {
          email: basicOnly.email,
          password: basicOnly.password,
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(`/profiles/${partial.body.publicSlug}`)).status,
      404,
    );
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${port}/api/member-photos/${partial.body.id}/0`,
          { headers: { "x-api-proxy-secret": proxySecret } },
        )
      ).status,
      404,
    );
    assert.equal(
      (await request("/profiles/1/interest", { note: "Hello" })).status,
      400,
    );
    assert.equal(
      (
        await request("/profiles/1/interest", {
          contactType: "telegram",
          contact: "@example_user",
          note: "Hello",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request("/profiles/1/interest", {
          contactType: "whatsapp",
          contact: "+919876543210",
          note: "simulate failure",
        })
      ).status,
      503,
    );
    await stop();
    await start("");
    const failed = await request(
      partialReview,
      { action: "approve" },
      admin.cookie,
    );
    assert.equal(failed.body.reviewStatus, "Approved");
    assert.equal(failed.body.notificationStatus, "Failed");
    assert.equal(
      (
        await request("/registration/login", {
          email: basicOnly.email,
          password: basicOnly.password,
        })
      ).status,
      200,
    );
    await stop();
    await start();
    assert.equal(
      (await request(partialReview, { action: "approve" }, admin.cookie)).body
        .notificationStatus,
      "Sent",
    );
    const logout = await request("/registration/admin/logout", {}, admin.cookie);
    assert.equal(logout.status, 200);
    assert.equal(logout.cookie, "ram_admin=");
    assert.equal((await request("/registration/admin/session", undefined, admin.cookie)).status, 401);
    assert.equal((await request("/registration/admin/registrations", undefined, admin.cookie)).status, 401);
    assert.equal((await request("/registration/admin/login", { password: "test-admin-password" })).status, 200);
  } finally {
    if (child && child.exitCode === null) await stop();
    await adminPool.query("DROP DATABASE " + testDb + " WITH (FORCE)");
    await adminPool.end();
  }
});
