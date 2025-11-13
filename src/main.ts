import { apiLogin, apiSignup, apiVerifyOtp } from "./api";
import { DirectLine } from "botframework-directlinejs";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function ensureAlertMount() {
  if (!document.getElementById("alert-backdrop")) {
    const b = document.createElement("div");
    b.id = "alert-backdrop";
    b.className = "alert-backdrop";
    document.body.appendChild(b);
  }
  if (!document.getElementById("alert-modal")) {
    const m = document.createElement("div");
    m.id = "alert-modal";
    m.className = "alert-modal";
    document.body.appendChild(m);
  }
}

type AlertKind = "info" | "error" | "success";
function showAlert(message: string, kind: AlertKind = "info", title?: string) {
  ensureAlertMount();
  const modal = document.getElementById("alert-modal")!;
  const backdrop = document.getElementById("alert-backdrop")!;
  const t = title ?? (kind === "error" ? "Something went wrong" : kind === "success" ? "Done" : "Notice");
  const btnClass = kind === "error" ? "alert-ok alert-ok--error" : kind === "success" ? "alert-ok alert-ok--success" : "alert-ok";
  modal.innerHTML = `
    <div class="alert-card" role="dialog" aria-modal="true">
      <div class="alert-title">${t}</div>
      <div class="alert-body">${message}</div>
      <div class="alert-actions"><button id="alert-ok" class="${btnClass}">OK</button></div>
    </div>`;
  const close = () => { backdrop.classList.remove("show"); modal.innerHTML=""; };
  backdrop.classList.add("show");
  document.getElementById("alert-ok")!.onclick = close;
  backdrop.onclick = close;
}

function friendlyMessage(res: any, fallback = "Please check your input and try again.") {
  // Prefer structured { code } from backend
  const code = typeof res?.code === "string" ? res.code : undefined;
  if (code) {
    const map: Record<string,string> = {
      EMAIL_IN_USE: "That email is already registered.",
      INVALID_CREDENTIALS: "Email or password is incorrect.",
      EMAIL_NOT_VERIFIED: "Please verify your email before logging in.",
      PASSWORD_TOO_SHORT: "Your password must be at least 8 characters.",
      REQUIRED_EMAIL: "Please enter your email address.",
      REQUIRED_NAME: "Please enter your full name."
    };
    return map[code] ?? fallback;
  }

  if (Array.isArray(res?.error)) {
    const first = res.error[0];
    const path = Array.isArray(first?.path) ? String(first.path[0]) : "";
    if (path === "identifier") return "Please enter your email or membership ID.";
    if (path === "email") return "Please enter a valid email address.";
    if (path === "password") return "Your password must be at least 8 characters.";
    if (path === "name") return "Please enter your full name.";
  }

  // If string, strip technical phrasing
  if (typeof res?.error === "string") {
    if (/Too small.*>=\s*8/.test(res.error)) return "Your password must be at least 8 characters.";
    if (/Too small.*>=\s*1/.test(res.error)) return "Please fill out the required fields.";
    if (/Invalid email/i.test(res.error)) return "Please enter a valid email address.";
    return res.error;
  }
  return fallback;
}

type Route = "login" | "signup" | "forgot" | "success" | "verified" | "chat";
const app = document.getElementById("app") as HTMLDivElement;

function navigate(route: Route) {
  if (location.hash.replace("#/", "") !== route) location.hash = `/${route}`;
  else render();
}
function currentRoute(): Route {
  const r = (location.hash || "#/login").replace("#/", "") as Route;
  return ["signup", "forgot", "success", "verified", "chat"].includes(r) ? r : "login";
}

type LayoutOpts = { watermark?: boolean };
function layout(subtitle: string, inner: string, opts: LayoutOpts = {}) {
  return `
  <div class="auth-shell">
    <div class="hero">
      <h1 class="logo"><span>Rotary</span><span class="wheel"></span><span>Club JP</span></h1>
      <p class="sub">${subtitle}</p>
    </div>
    <div class="card ${opts.watermark ? "card--wm" : ""}">
      ${inner}
    </div>
    <p class="footer-note small">© ${new Date().getFullYear()} Rotary Club JP</p>
  </div>`;
}

function successView() {
  const name = localStorage.getItem("name") || "Member";
  return layout(
    "Welcome!",
    `
    <div>
      <p>Login successful. Hello, <strong>${name}</strong> 🎉</p>
      <div class="actions" style="margin-top:16px;">
        <button class="btn" id="logout">Logout</button>
      </div>
    </div>
    `
  );
}

function chatView() {
  const name = localStorage.getItem("name") || "Member";
  return `
  <div class="chat-page">
    <div class="chat-card">
      <header class="chat-header">
        <div class="chat-header-left">
          <div class="chat-logo">
            <span class="chat-logo-icon">💬</span>
            <div class="chat-logo-text">
              <span class="chat-logo-title">AI Chat Support</span>
              <span class="chat-logo-sub">Powered by Copilot Studio</span>
            </div>
          </div>
        </div>
        <div class="chat-header-right">
          <div class="chat-user">
            <span class="chat-user-avatar">👤</span>
            <span class="chat-user-name">こんにちは、${name}さん</span>
          </div>
          <button class="btn btn-logout" id="logout">ログアウト</button>
        </div>
      </header>

      <main class="chat-main">
        <div class="chat-topic-banner">
          <span>チャットボット</span>
        </div>

        <div id="messages" class="chat-messages">
          <!-- messages will be appended here -->
        </div>
      </main>

      <footer class="chat-footer">
        <div class="chat-input-wrapper">
          <input
            id="userInput"
            type="text"
            class="chat-input"
            placeholder="メッセージに質問を入力してください…"
          />
          <button id="send" class="chat-send-btn" aria-label="Send message">
            ✈
          </button>
        </div>
        <p class="chat-footer-note">
          このチャットは Microsoft Copilot Studio が使われています。
        </p>
      </footer>
    </div>
  </div>`;
}


function verifiedView() {
  return layout(
    "Email Verification",
    `
    <form id="verify-form" novalidate>
      <p>We sent a verification code to your email. Please enter it below.</p>
      <label for="ver-email">Email Address</label>
      <div class="input">
        <input
          id="ver-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <label for="ver-otp">Verification Code</label>
      <div class="input">
        <input
          id="ver-otp"
          name="otp"
          type="text"
          maxlength="6"
          placeholder="6-digit code"
          required
        />
      </div>
      <div class="actions" style="margin-top: 16px;">
        <button type="submit" class="btn" id="verify-btn">Verify Email</button>
        <button type="button" class="btn-link" id="v-go-login">Back to Login</button>
      </div>
    </form>
    `,
    { watermark: false }
  );
}

function loginView() {
  return layout(
    "Member Login",
    `
    <form id="login-form" novalidate>
      <label for="login-id">Email Address or Membership ID</label>
      <div class="input">
        <input id="login-id" name="identifier" type="text" placeholder="you@example.com or 12345678" required />
      </div>

      <label for="login-pass">Password</label>
      <div class="input">
        <input id="login-pass" name="password" type="password" placeholder="••••••••" required minlength="8" />
      </div>

      <div class="actions">
        <button type="submit" class="btn" id="login-btn">Login</button>
        <button class="btn-link" type="button" id="go-forgot">Forgot password?</button>
      </div>
      <p class="small">Don't have an account? <button type="button" class="btn-link" id="go-signup">Sign Up</button></p>
      <p class="small">Didn't get a code? <button type="button" class="btn-link" id="resend">Resend verification code</button></p>
    </form>
    `,
    { watermark: false }
  );
}

function signupView() {
  return layout(
    "Join Rotary Club JP",
    `
    <form id="signup-form" novalidate>
      <label for="full-name">Full Name</label>
      <div class="input">
        <input id="full-name" name="name" type="text" placeholder="Jane Doe" required />
      </div>

      <div class="form-row">
        <div>
          <label for="email">Email Address</label>
          <div class="input"><input id="email" name="email" type="email" placeholder="you@example.com" required /></div>
        </div>
        <div>
          <label for="phone">Phone (optional)</label>
          <div class="input"><input id="phone" name="phone" type="tel" placeholder="+81 90 1234 5678" /></div>
        </div>
      </div>

      <div class="form-row">
        <div>
          <label for="pass">Create Password</label>
          <div class="input"><input id="pass" name="password" type="password" minlength="8" placeholder="At least 8 characters" required /></div>
        </div>
        <div>
          <label for="pass2">Confirm Password</label>
          <div class="input"><input id="pass2" name="password2" type="password" minlength="8" placeholder="Repeat password" required /></div>
        </div>
      </div>

      <div class="checkbox" style="margin-top:12px;">
        <input id="terms" type="checkbox" required />
        <label for="terms">I agree to Terms and Conditions</label>
      </div>

      <div class="actions">
        <button type="submit" class="btn" id="signup-btn">Sign Up</button>
        <button type="button" class="btn-link" id="go-login">Already have an account? Login</button>
      </div>
      
    </form>
    `,
    { watermark: false }
  );
}

function forgotView() {
  return layout(
    "Reset your password",
    `
    <form id="forgot-form" novalidate>
      <label for="fp-email">Email Address</label>
      <div class="input"><input id="fp-email" name="email" type="email" placeholder="you@example.com" required /></div>

      <div class="actions">
        <button type="submit" class="btn">Send Reset Link</button>
        <button type="button" class="btn-link" id="go-login">Back to Login</button>
      </div>
    </form>
    `,
    { watermark: false }
  );
}

function render() {
  const route = currentRoute();
  if (!app) return;

  app.innerHTML =
    route === "signup" ? signupView()
    : route === "forgot" ? forgotView()
    : route === "verified" ? verifiedView()
    : route === "chat" ? chatView()
    : route === "success" ? successView()
    : loginView();

  attachHandlers(route);
}

function attachHandlers(route: Route) {
  const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  $("#go-login")?.addEventListener("click", () => navigate("login"));
  $("#go-signup")?.addEventListener("click", () => navigate("signup"));
  $("#go-forgot")?.addEventListener("click", () => navigate("forgot"));

  if (route === "login") {
    const form = document.getElementById("login-form") as HTMLFormElement;
    const btn = document.getElementById("login-btn") as HTMLButtonElement;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const identifier = String(data.get("identifier") || "");
      const password = String(data.get("password") || "");
      if (!identifier || password.length < 8) {
        showAlert("Enter your email/ID and a password of at least 8 characters.", "error");
        return;
      }
      btn.disabled = true;
      try {
        const res = await apiLogin(identifier, password);
        if (res.ok) {
          localStorage.setItem("token", res.token);
          localStorage.setItem("name", res.user?.name || "");
          showAlert("You are now logged in.", "success", "Welcome");
          navigate("chat");
        } else {
            showAlert(friendlyMessage(res, "Unable to log you in."), "error");
        }
      } catch (err) {
        showAlert("Network error. Please try again.", "error");
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById("resend")?.addEventListener("click", async () => {
  const email = (document.getElementById("login-id") as HTMLInputElement)?.value.trim();
  if (!email || !email.includes("@")) {
    showAlert("Enter your email in the first field, then click Resend.", "error");
    return;
  }
  try {
    const r = await fetch(`${import.meta.env.VITE_API_URL}/auth/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await r.json();
    if (j.ok) showAlert("If an account exists, a new verification email has been sent.", "success");
    else showAlert("Couldn't resend verification email. Please try again.", "error");
  } catch {
    showAlert("Network error. Please try again.", "error");
  }
});
  }

  if (route === "signup") {
    const form = document.getElementById("signup-form") as HTMLFormElement;
    const btn = document.getElementById("signup-btn") as HTMLButtonElement;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const pass = String(f.get("password") || "");
      const pass2 = String(f.get("password2") || "");
      if (pass !== pass2) { showAlert("Passwords do not match.", "error"); return; }
      if (!(document.getElementById("terms") as HTMLInputElement).checked) {
        showAlert("Please agree to the Terms and Conditions.", "error"); return;
      }
      btn.disabled = true;
      try {
        const res = await apiSignup({
        name: String(f.get("name") || ""),
        email: String(f.get("email") || ""),
        phone: String(f.get("phone") || ""),
        password: pass
        });
        if (res.ok) {
          showAlert("Signup successful! Please check your email for the verification code.", "success");
          setTimeout(() => navigate("verified"), 500);
        } else {
          showAlert(friendlyMessage(res, "Signup failed. Please review your details."), "error");
        }
      } catch {
        showAlert("Network error. Please try again.", "error");
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (route === "verified") {
    const form = document.getElementById("verify-form") as HTMLFormElement | null;
    const btn = document.getElementById("verify-btn") as HTMLButtonElement | null;
    document.getElementById("v-go-login")?.addEventListener("click", () => navigate("login"));
    if (!form || !btn) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const email = String(data.get("email") || "").trim();
      const otp = String(data.get("otp") || "").trim();

      if (!email || !otp) {
        showAlert("Please enter your email and the verification code.", "error");
        return;
      }

      btn.disabled = true;
      try {
        const r = await fetch(`${API}/auth/verify-email-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        });
        const res = await r.json();

        if (res.ok) {
          showAlert("Your email has been verified. You can now log in.", "success");
          setTimeout(() => navigate("login"), 500);
        } else {
          showAlert(friendlyMessage(res, "Verification failed. Please check the code and try again."), "error");
        }
      } catch {
        showAlert("Network error while verifying. Please try again.", "error");
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (route === "chat") {
    startDirectLine();
    document.getElementById("logout")?.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("name");
      navigate("login");
    });
  }


  if (route === "success") {
    document.getElementById("logout")?.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("name");
      navigate("login");
    });
  }
}

let directLine: any;

function startDirectLine() {
  const directLineSecret = "YOUR_DIRECT_LINE_SECRET"; // 🔑 Replace with your own
  directLine = new DirectLine({ secret: directLineSecret });

  const messagesDiv = document.getElementById("messages");

  // Listen for messages
  directLine.activity$.subscribe((activity: any) => {
    if (activity.type === "message" && activity.from.id !== "user") {
      const botMsg = document.createElement("div");
      botMsg.className = "bot";
      botMsg.textContent = activity.text;
      messagesDiv?.appendChild(botMsg);
      messagesDiv?.scrollTo(0, messagesDiv.scrollHeight);
    }
  });

  // Send message handler
  document.getElementById("send")?.addEventListener("click", () => {
    const box = document.getElementById("userInput") as HTMLInputElement;
    const text = box.value.trim();
    if (!text) return;
    const youMsg = document.createElement("div");
    youMsg.className = "you";
    youMsg.textContent = text;
    messagesDiv?.appendChild(youMsg);
    box.value = "";
    directLine.postActivity({
      from: { id: "user", name: "User" },
      type: "message",
      text
    }).subscribe();
  });
}


window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);
if (!location.hash) navigate("login");
