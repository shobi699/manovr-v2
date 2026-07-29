import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  throw new Error(
    "AUTH_SECRET is not set, or is shorter than 32 characters. " +
      "Session tokens cannot be signed safely without it. " +
      "Set AUTH_SECRET to a random 32+ character value before starting the server. " +
      "See README.md and .env.example."
  );
}

const secret = new TextEncoder().encode(AUTH_SECRET);
const COOKIE = "manovr_session";

export interface Session {
  id: number;
  userName: string;
  fullName: string;
  role: number;
  perms?: string[]; // مجوزهای نقش سفارشی (از v3)
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
