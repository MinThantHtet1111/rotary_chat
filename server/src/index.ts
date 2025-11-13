import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { transporter } from "./mail";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: false
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

(async () => {
  try {
    if (!transporter || typeof (transporter as any).verify !== "function") {
      console.warn(
        "⚠️  SMTP transporter is not configured. Skipping SMTP verification."
      );
      return;
    }

    await transporter.verify();
    console.log("✅ SMTP ready");
  } catch (e) {
    console.error("❌ SMTP config error:", e);
    // NOTE: we just log the error; server keeps running
  }
})();