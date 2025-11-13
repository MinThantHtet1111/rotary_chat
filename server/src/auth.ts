import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import { query } from "./db";
import { sendVerificationEmail } from "./mail";

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or membership ID (we use email here)
  password: z.string().min(8)
});

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createUser(input: z.infer<typeof signupSchema>) {
  const { name, email, phone, password } = signupSchema.parse(input);
  const lower = email.toLowerCase();

  const exists = await query("SELECT 1 FROM users WHERE email=$1", [lower]);
  if (exists.rowCount) {
    throw new Error("Email already registered");
  }

  const id = uuid();
  const password_hash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO users (id, name, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [id, name, lower, phone || null, password_hash]
  );

  // create verification token
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 12);
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await query(
    `INSERT INTO email_verifications (id, user_id, token, expires_at, used)
     VALUES ($1,$2,$3,$4,false)`,
    [uuid(), id, otpHash, expires]
  );

  await sendVerificationEmail(email, otp);
  return { id, email: lower };
}

export async function verifyEmailOTP(email: string, otp: string) {
  const lower = email.toLowerCase();
  const res = await query(
    `SELECT ev.id, ev.user_id, ev.expires_at, ev.used, ev.token
     FROM email_verifications ev
     JOIN users u ON u.id = ev.user_id
     WHERE u.email = $1
     ORDER BY ev.expires_at DESC
     LIMIT 1`,
    [lower]
  );
  if (!res.rowCount) {
    throw new Error("OTP not found");
  }
  const row = res.rows[0];
  if (row.used) {
    throw new Error("OTP already used");
  }
  if (new Date(row.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }
  const isMatch = await bcrypt.compare(otp, row.token);
  if (!isMatch) {
    throw new Error("Invalid OTP");
  }
  await query(
    "UPDATE users SET email_verified_at=NOW(), updated_at=NOW() WHERE id=$1",
    [row.user_id]
  );
  await query(
    "UPDATE email_verifications SET used=true WHERE id=$1",
    [row.id]
  );
  return { ok: true };
}

export async function verifyEmail(token: string) {
  const res = await query(
    `SELECT ev.id, ev.user_id, ev.expires_at, ev.used, u.email_verified_at
     FROM email_verifications ev
     JOIN users u ON u.id = ev.user_id
     WHERE ev.token=$1`,
    [token]
  );
  if (!res.rowCount) throw new Error("Invalid token");
  const row = res.rows[0];
  if (row.used) throw new Error("Token already used");
  if (new Date(row.expires_at) < new Date()) throw new Error("Token expired");

  await query("UPDATE users SET email_verified_at=NOW(), updated_at=NOW() WHERE id=$1", [row.user_id]);
  await query("UPDATE email_verifications SET used=true WHERE id=$1", [row.id]);
  return { ok: true };
}

export async function loginUser(input: z.infer<typeof loginSchema>) {
  const { identifier, password } = loginSchema.parse(input);
  const res = await query(
    `SELECT id, name, email, password_hash, email_verified_at
     FROM users WHERE email=$1`,
    [identifier.toLowerCase()]
  );
  if (!res.rowCount) throw new Error("Invalid email or password");
  const user = res.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error("Invalid email or password");
  if (!user.email_verified_at) {
    throw new Error("Email not verified");
  }
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}
