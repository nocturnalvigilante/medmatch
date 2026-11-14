import { createClient } from "@supabase/supabase-js";

// Browser client that sends the Clerk session token, so RLS sees the Clerk user id as auth.jwt()->>'sub'.
export function supabaseWithClerk(getToken: () => Promise<string | null>) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: getToken,
  });
}
