// Delete Account — Supabase Edge Function
// Handles: SQL data cleanup via RPC, Storage file deletion, Paddle cancellation, auth user deletion.
// Deploy: npx supabase functions deploy delete-account --project-ref smgbojgrdezasxciloll --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://smgbojgrdezasxciloll.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") || "";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Verify caller's JWT ──────────────────────────────────────────────────────
async function verifyAuth(authHeader: string): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ─── Cancel Paddle subscription ───────────────────────────────────────────────
async function cancelPaddleSubscription(userId: string): Promise<void> {
  if (!PADDLE_API_KEY) {
    console.warn("⚠️ PADDLE_API_KEY not set — skipping subscription cancellation");
    return;
  }
  try {
    const { data: subs } = await supa
      .from("subscriptions")
      .select("paddle_subscription_id")
      .eq("user_id", userId)
      .not("paddle_subscription_id", "is", null);
    if (!subs?.length) return;
    for (const sub of subs) {
      if (!sub.paddle_subscription_id) continue;
      try {
        const res = await fetch(
          `https://api.paddle.com/subscriptions/${sub.paddle_subscription_id}/cancel`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${PADDLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ effective_from: "immediately" }),
          }
        );
        if (res.ok) {
          console.log(`✅ Cancelled Paddle subscription ${sub.paddle_subscription_id}`);
        } else {
          const err = await res.text().catch(() => "");
          console.error(`❌ Paddle cancel failed (${res.status}):`, err);
          // Proceed anyway — subscription will fail on next renewal
        }
      } catch (e) {
        console.error(`❌ Paddle cancel error for ${sub.paddle_subscription_id}:`, e);
      }
    }
  } catch (e) {
    console.error("❌ Paddle subscription lookup failed:", e);
  }
}

// ─── Delete Storage files ─────────────────────────────────────────────────────
async function deleteStorageFiles(userId: string): Promise<void> {
  // Inbox files: inbox/{userId}/
  try {
    const { data: inboxFiles } = await supa.storage.from("huddledin-files").list("inbox/" + userId);
    if (inboxFiles?.length) {
      const paths = inboxFiles.map((f: any) => "inbox/" + userId + "/" + f.name);
      await supa.storage.from("huddledin-files").remove(paths);
      console.log(`✅ Deleted ${paths.length} inbox files`);
    }
  } catch (e) {
    console.error("❌ Inbox file cleanup:", e);
  }
  // Specialist storage: {userId}/
  try {
    const { data: specFiles } = await supa.storage.from("specialist-storage").list(userId);
    if (specFiles?.length) {
      const paths = specFiles.map((f: any) => userId + "/" + f.name);
      await supa.storage.from("specialist-storage").remove(paths);
      console.log(`✅ Deleted ${paths.length} specialist storage files`);
    }
  } catch (e) {
    console.error("❌ Specialist storage cleanup:", e);
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Verify the caller is authenticated
  const userId = await verifyAuth(req.headers.get("Authorization") || "");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { mode } = body;
  // mode: 'parent' | 'specialist_keep' | 'specialist_delete'

  if (!["parent", "specialist_keep", "specialist_delete"].includes(mode)) {
    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log(`🗑️ Delete account: user=${userId}, mode=${mode}`);

  try {
    // 1. Cancel Paddle subscription (proceed even if this fails)
    await cancelPaddleSubscription(userId);

    // 2. Delete storage files
    await deleteStorageFiles(userId);

    // 3. Run the appropriate SQL cleanup function
    const rpcName = mode === "parent"
      ? "delete_parent_account"
      : mode === "specialist_keep"
        ? "delete_specialist_keep_records"
        : "delete_specialist_with_records";

    const { error: rpcError } = await supa.rpc(rpcName, { p_user_id: userId });
    if (rpcError) {
      console.error(`❌ RPC ${rpcName} failed:`, rpcError);
      return new Response(JSON.stringify({ error: "Account deletion failed: " + rpcError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`✅ RPC ${rpcName} completed`);

    // 4. Delete auth user (must be last — after all data is cleaned up)
    const { error: authError } = await supa.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("❌ Auth user deletion failed:", authError);
      // Data is already deleted — log but don't fail the response
    } else {
      console.log("✅ Auth user deleted");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ Delete account error:", e);
    return new Response(JSON.stringify({ error: "Account deletion failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
