import { IncomingMessage, ServerResponse } from "http";
import jwt from "jsonwebtoken";
import { getUsers } from "./db";
import { User } from "./types";

const SECRET = "nie_powiem";

export function generateToken(userId: string): string {
  const token = jwt.sign({ id: userId }, SECRET, { expiresIn: "10m" });
  return token;
}

export function getUserFromToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, SECRET) as {
      id: string;
    };
    return getUsers().find((user) => user.id === decoded.id) || null;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: ServerResponse, token: string) {
  res.setHeader("Set-Cookie", `token=${token}; HttpOnly; Max-Age=600`);
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookieHeader = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split("; ").forEach((cookie) => {
      const [name, value] = cookie.split("=");
      cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}
