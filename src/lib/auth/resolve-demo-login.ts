/**
 * Allows users to log in with a short username (e.g. "prueba")
 * by mapping it to the full Supabase email address.
 *
 * Add more demo / shorthand aliases here as needed.
 */
const DEMO_ALIASES: Record<string, string> = {
  prueba: "prueba@prueba.com",
};

/**
 * Returns the real email to use for Supabase signInWithPassword.
 * If the input looks like a full email it is returned unchanged.
 */
export function resolveLoginEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  return DEMO_ALIASES[trimmed] ?? input.trim();
}
