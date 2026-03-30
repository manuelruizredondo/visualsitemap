import { createClient } from "./server";

/**
 * Get the current authenticated user from server-side.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Require authentication. Throws if not authenticated.
 * Use in API routes to protect endpoints.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error("No autorizado");
  }
  return user;
}
