import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

type AuthenticationResult =
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      user: User;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      error: string;
    };

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticationResult> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Please sign in to continue.",
    };
  }
  if (!url || !anonKey) {
    return {
      ok: false,
      status: 503,
      error: "Supabase is not configured on the server.",
    };
  }

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      error: "Please sign in to continue.",
    };
  }

  const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "The server has no allowed account emails configured.",
    };
  }
  if (!data.user.email || !allowedEmails.includes(data.user.email.toLowerCase())) {
    return {
      ok: false,
      status: 403,
      error: "This account is not allowed to use this workspace.",
    };
  }

  return { ok: true, supabase, user: data.user };
}
