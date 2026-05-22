import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

const getUrl = () =>
  (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();

const getServiceKey = () =>
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = getUrl();
  // Use the publishable/anon key — never the service role key here
  const key =
    (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim() ||
    (process.env.SUPABASE_ANON_KEY || "").trim() ||
    "";
  if (!url) throw new Error("SUPABASE_URL / VITE_SUPABASE_URL env var not set");
  if (!key) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY env var not set");
  _client = createClient(url, key);
  return _client;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;
  const url = getUrl();
  const serviceKey = getServiceKey();
  if (!url) throw new Error("SUPABASE_URL / VITE_SUPABASE_URL env var not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var not set");
  _adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
}
