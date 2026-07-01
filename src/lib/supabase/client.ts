import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StorageMode = "local" | "session";

const clients: Partial<Record<StorageMode, SupabaseClient>> = {};
const storageKeys: Record<StorageMode, string> = {
  local: "emo-academy-local-auth",
  session: "emo-academy-session-auth",
};

type HuggingFaceWindow = Window & {
  huggingface?: {
    variables?: Record<string, string | undefined>;
  };
  __EMOACADEMY_ENV__?: Record<string, string | undefined>;
};

function getSupabaseConfig() {
  const variables =
    typeof window === "undefined"
      ? undefined
      : {
          ...(window as HuggingFaceWindow).huggingface?.variables,
          ...(window as HuggingFaceWindow).__EMOACADEMY_ENV__,
        };

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || variables?.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || variables?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url?.startsWith("https://") && key);
}

export function getSupabaseBrowserClient(mode: StorageMode = "local") {
  if (!isSupabaseConfigured() || typeof window === "undefined") return null;
  if (clients[mode]) return clients[mode]!;
  const { url, key } = getSupabaseConfig();

  clients[mode] = createClient(url!, key!, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // The callback page exchanges the PKCE code explicitly. Enabling the
      // automatic URL detector as well can consume the verifier twice.
      detectSessionInUrl: false,
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
