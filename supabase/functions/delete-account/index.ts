import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const admin = createClient(url, serviceRoleKey);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
  return Response.json({ deleted: true }, { headers: corsHeaders });
});
