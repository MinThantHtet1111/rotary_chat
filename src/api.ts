const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export type SignupPayload = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};
export async function apiSignup(p: SignupPayload) {
  const res = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  });
  return res.json();
}

export async function apiLogin(identifier: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password })
  });
  return res.json();
}

export async function apiVerify(token: string) {
  const res = await fetch(`${API}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  return res.json();
}

export async function apiVerifyOtp(email: string, otp: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-email-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  return res.json();
}