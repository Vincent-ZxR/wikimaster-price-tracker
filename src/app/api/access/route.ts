import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  createAccessSession,
  getServerConfig,
  getSessionSigningSecret,
  isAuthorizedRequest,
} from "@/lib/server-auth";

function matchesPassword(input: string, expected: string): boolean {
  const inputHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export async function GET(request: Request) {
  const server = getServerConfig();
  if (!server.ok) {
    return Response.json({ error: server.error }, { status: 503 });
  }
  return Response.json({
    authorized: isAuthorizedRequest(
      request,
      getSessionSigningSecret(server.config.sessionSecret, server.config.accessPassword),
    ),
  });
}

export async function POST(request: Request) {
  const server = getServerConfig();
  if (!server.ok) {
    return Response.json({ error: server.error }, { status: 503 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Données JSON invalides." }, { status: 400 });
  }
  if (!input || typeof input !== "object") {
    return Response.json({ error: "Mot de passe invalide." }, { status: 400 });
  }
  const password = (input as Record<string, unknown>).password;
  if (typeof password !== "string" || password.length > 1024) {
    return Response.json({ error: "Mot de passe invalide." }, { status: 400 });
  }
  if (!matchesPassword(password, server.config.accessPassword)) {
    return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ authorized: true });
  response.cookies.set(ACCESS_COOKIE, createAccessSession(
    getSessionSigningSecret(server.config.sessionSecret, server.config.accessPassword),
  ), {
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authorized: false });
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
