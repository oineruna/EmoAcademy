import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StorageMode = "local" | "session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const clients: Partial<Record<StorageMode, SupabaseClient>> = {};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl?.startsWith("https://") && supabaseKey);
}

export function getSupabaseBrowserClient(mode: StorageMode = "local") {
  if (!isSupabaseConfigured() || typeof window === "undefined") return null;
  if (clients[mode]) return clients[mode]!;

  clients[mode] = createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: mode === "local" ? window.localStorage : window.sessionStorage,
      storageKey: `quizroom-${mode}-auth`,
    },
  });
  return clients[mode]!;
}

export async function getActiveSupabaseClient() {
  for (const mode of ["local", "session"] as const) {
    const client = getSupabaseBrowserClient(mode);
    if (!client) continue;
    const { data } = await client.auth.getSession();
    if (data.session) return { client, session: data.session };
  }
  return null;
}
