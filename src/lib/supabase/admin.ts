import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role.
 * Bypasses RLS — only use in trusted server contexts (API routes, background jobs).
 * Requires SUPABASE_SERVICE_ROLE_KEY in the server environment (never expose to client).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
