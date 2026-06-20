import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StorageMode = "local" | "session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const clients: Partial<Record<StorageMode, SupabaseClient>> = {};
const storageKeys: Record<StorageMode, string> = {
  local: "emo-academy-local-auth",
  session: "emo-academy-session-auth",
};

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
      storageKey: storageKeys[mode],
    },
  });
  return clients[mode]!;
}

export async function clearSupabaseSessions() {
  if (typeof window === "undefined") return;
  await Promise.allSettled(
    Object.values(clients).map((client) => client.auth.signOut({ scope: "local" })),
  );
  window.localStorage.removeItem(storageKeys.local);
  window.sessionStorage.removeItem(storageKeys.session);
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
