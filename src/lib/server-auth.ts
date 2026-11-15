import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const ACCESS_COOKIE = "wikitrack_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type ServerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  accessPassword: string;
  sessionSecret: string;
};

type ConfigurationResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; error: string };

type AuthenticationResult =
  | { ok: true; supabase: SupabaseClient<Database> }
  | { ok: false; status: 401 | 503; error: string };

export function getServerConfig(): ConfigurationResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessPassword = process.env.SHARED_ACCESS_PASSWORD;
  const sessionSecret = process.env.APP_SESSION_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !accessPassword || !sessionSecret) {
    return {
      ok: false,
      error: "Supabase ou l’accès partagé n’est pas configuré sur le serveur.",
    };
  }
  if (accessPassword.length < 16 || Buffer.byteLength(sessionSecret) < 32) {
    return {
      ok: false,
      error: "Le mot de passe partagé doit faire au moins 16 caractères et la clé de session au moins 32 octets.",
    };
  }

  return {
    ok: true,
    config: { supabaseUrl, serviceRoleKey, accessPassword, sessionSecret },
  };
}

function getCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

export function createAccessSession(secret: string, now = Date.now()): string {
  const expiresAt = String(now + ACCESS_COOKIE_MAX_AGE * 1000);
  const signature = createHmac("sha256", secret).update(expiresAt).digest("hex");
  return `${expiresAt}.${signature}`;
}

export function getSessionSigningSecret(sessionSecret: string, accessPassword: string): string {
  return createHmac("sha256", sessionSecret).update(accessPassword).digest("hex");
}

function isValidAccessSession(value: string | null, secret: string, now = Date.now()): boolean {
  if (!value) return false;
  const [expiresAt, signature, ...extra] = value.split(".");
  if (extra.length > 0 || !/^\d+$/.test(expiresAt ?? "") ||
      !/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;

  const expiration = Number(expiresAt);
  if (!Number.isSafeInteger(expiration) || expiration <= now) return false;

  const expected = createHmac("sha256", secret).update(expiresAt).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function isAuthorizedRequest(request: Request, secret: string): boolean {
  return isValidAccessSession(getCookie(request, ACCESS_COOKIE), secret);
}

export async function authenticateRequest(request: Request): Promise<AuthenticationResult> {
  const server = getServerConfig();
  if (!server.ok) {
    return { ok: false, status: 503, error: server.error };
  }
  if (!isAuthorizedRequest(
    request,
    getSessionSigningSecret(server.config.sessionSecret, server.config.accessPassword),
  )) {
    return { ok: false, status: 401, error: "Saisissez le mot de passe partagé pour continuer." };
  }

  const supabase = createClient<Database>(
    server.config.supabaseUrl,
    server.config.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  return { ok: true, supabase };
}
