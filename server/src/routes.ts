import { Router } from "express";
import { createUser, loginUser, verifyEmail, verifyEmailOTP, signupSchema, loginSchema } from "./auth";
import { z } from "zod";
import { ZodError } from "zod";
import { query } from "./db";
import { sendVerificationEmail } from "./mail";
import { v4 as uuid } from "uuid";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
const fetch = (globalThis as any).fetch;

const r = Router();

function sendError(res: any, code: string, http = 400) {
  res.status(http).json({ ok: false, code });
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

r.post("/auth/signup", async (req, res) => {
  try {
    const body = signupSchema.parse(req.body);
    const result = await createUser(body);
    res.status(201).json({ ok: true, user: result, message: "Check your email to verify your account." });
  } catch (e: any) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      if (first?.path?.[0] === "email") return sendError(res, "REQUIRED_EMAIL");
      if (first?.path?.[0] === "password") return sendError(res, "PASSWORD_TOO_SHORT");
      if (first?.path?.[0] === "name") return sendError(res, "REQUIRED_NAME");
      return sendError(res, "INVALID_INPUT");
    }
    if (/already registered/i.test(e.message)) return sendError(res, "EMAIL_IN_USE");
    return sendError(res, "SIGNUP_FAILED");
  }
});

r.post("/auth/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      if (first?.path?.[0] === "identifier") return sendError(res, "REQUIRED_EMAIL");
      if (first?.path?.[0] === "password") return sendError(res, "PASSWORD_TOO_SHORT");
      return sendError(res, "INVALID_INPUT");
    }
    if (/not verified/i.test(e.message)) return sendError(res, "EMAIL_NOT_VERIFIED");
    if (/Invalid email or password/i.test(e.message)) return sendError(res, "INVALID_CREDENTIALS");
    return sendError(res, "LOGIN_FAILED");
  }
});

r.post("/auth/verify-email-otp", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().min(4).max(10),
  });

  try {
    const { email, otp } = schema.parse(req.body);
    await verifyEmailOTP(email, otp); // from ./auth
    return res.json({ ok: true });
  } catch (e: any) {
    return res
      .status(400)
      .json({ ok: false, error: e.message || "Verification failed" });
  }
});

r.post("/auth/resend", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, code: "REQUIRED_EMAIL" });
    }

    const u = await query(
      "SELECT id, email_verified_at FROM users WHERE email=$1",
      [email]
    );

    // Don't leak whether the email exists
    if (!u.rowCount) return res.json({ ok: true });

    if (u.rows[0].email_verified_at) {
      // already verified -> nothing to do
      return res.json({ ok: true });
    }

    const userId = u.rows[0].id;

    // generate & hash OTP
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // store new OTP (token column now holds hashed OTP)
    await query(
      `INSERT INTO email_verifications (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uuid(), userId, otpHash, expires]
    );

    // send OTP by email
    await sendVerificationEmail(email, otp);

    return res.json({ ok: true });
  } catch (e) {
    console.error("RESEND_FAILED:", e);
    return res.status(500).json({ ok: false, code: "RESEND_FAILED" });
  }
});

r.post("/directline/token", async (req, res) => {
  try {
    const secret = process.env.DIRECT_LINE_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "DIRECT_LINE_SECRET not configured" });
    }

    const dlRes = await fetch(
      "https://directline.botframework.com/v3/directline/tokens/generate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      }
    );

    if (!dlRes.ok) {
      const text = await dlRes.text();
      console.error("DirectLine token error:", dlRes.status, text);
      return res
        .status(500)
        .json({ error: "Failed to create Direct Line token" });
    }

    const json = await dlRes.json();
    // json has { token, conversationId, expires_in, ... }
    res.json({ token: json.token });
  } catch (err) {
    console.error("DirectLine token exception:", err);
    res.status(500).json({ error: "Error creating Direct Line token" });
  }
});

// Link in email goes to FRONTEND with ?token=..., but we also expose a JSON endpoint
// r.post("/auth/verify", async (req, res) => {
//   const schema = z.object({ token: z.string().min(10) });
//   try {
//     const { token } = schema.parse(req.body);
//     await verifyEmail(token);
//     res.json({ ok: true });
//   } catch (e: any) {
//     res.status(400).json({ ok: false, error: e.message || "Verification failed" });
//   }
// });

// r.post("/auth/resend", async (req, res) => {
//   try {
//     const email = String(req.body?.email || "").toLowerCase();
//     if (!email) return res.status(400).json({ ok: false, code: "REQUIRED_EMAIL" });

//     const u = await query("SELECT id, email_verified_at FROM users WHERE email=$1", [email]);
//     if (!u.rowCount) return res.json({ ok: true }); // don't leak existence
//     if (u.rows[0].email_verified_at) return res.json({ ok: true });

//     const token = randomBytes(32).toString("hex");
//     const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
//     await query(
//       `INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES ($1,$2,$3,$4)`,
//       [uuid(), u.rows[0].id, token, expires]
//     );
//     await sendVerificationEmail(email, token);
//     res.json({ ok: true });
//   } catch (e) {
//     res.status(500).json({ ok: false, code: "RESEND_FAILED" });
//   }
// })

export default r;
