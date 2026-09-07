import {
  pgTable,
  text,
  bigint,
  integer,
  jsonb,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

export const registrations = pgTable("registrations", {
  id: text("id").primaryKey(),
  publicId: bigint("public_id", { mode: "number" })
    .generatedByDefaultAsIdentity()
    .unique("registrations_public_id_key"),
  email: text("email").notNull().unique("registrations_email_key"),
  mobile: text("mobile").notNull().unique("registrations_mobile_key"),
  password: text("password").notNull(),
  record: jsonb("record").notNull(),
});
export const registrationSessions = pgTable(
  "registration_sessions",
  {
    token: text("token").primaryKey(),
    member: text("member").notNull(),
    expires: bigint("expires", { mode: "number" }).notNull(),
  },
  (table) => [
    index("registration_sessions_expires_idx").on(table.expires),
    foreignKey({
      columns: [table.member],
      foreignColumns: [registrations.id],
      name: "registration_sessions_member_fkey",
    }).onDelete("cascade"),
  ],
);
export const registrationSettings = pgTable("registration_settings", {
  id: integer("id").primaryKey(),
  value: jsonb("value").notNull(),
});
export const registrationAdminSessions = pgTable(
  "registration_admin_sessions",
  {
    token: text("token").primaryKey(),
    expires: bigint("expires", { mode: "number" }).notNull(),
  },
  (table) => [
    index("registration_admin_sessions_expires_idx").on(table.expires),
  ],
);
