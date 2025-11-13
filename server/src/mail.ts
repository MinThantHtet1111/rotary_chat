import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Export transporter (or null if not configured)
export const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // SSL
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      })
    : null;

export async function sendVerificationEmail(email: string, otp: string) {
  if (!transporter) {
    console.warn("⚠️ No SMTP configured — skipping email sending.");
    return;
  }

  await transporter.sendMail({
    to: email,
    from: "no-reply@example.com",
    subject: "Your verification code",
    html: `
      <p>Thank you for signing up.</p>
      <p>Your email verification code is:</p>
      <p style="font-size: 24px; font-weight: bold;">${otp}</p>
      <p>This code is valid for 10 minutes.</p>
    `,
  });
}
