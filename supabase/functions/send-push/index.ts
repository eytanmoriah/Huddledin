// Send Web Push — Supabase Edge Function
// Triggered by Database Webhook on notifications table INSERT.
// Reads push_subscriptions for the notification's user_id, sends VAPID-signed Web Push.
// Cleans up expired endpoints (410/404).
// Deploy: npx supabase functions deploy send-push --project-ref smgbojgrdezasxciloll --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://smgbojgrdezasxciloll.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@huddledin.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Build a human-readable title + URL from a notification row
function buildPayload(notif: any) {
  const type = notif.type || "default";
  const message = notif.message || "";
  const childId = notif.child_id;
  // Title based on type
  const titleByType: Record<string, string> = {
    message: "💬 New message",
    chat: "💬 New message",
    appointment_declined: "📅 Event declined",
    appointments: "📅 New appointment",
    homework: "✅ Homework update",
    report: "📋 New session summary",
    invite: "🤝 Team update",
    consult: "🔗 Consultation request",
    files: "📁 File update",
    todo: "📝 New task",
  };
  const title = titleByType[type] || "🤝 Huddledin";
  // URL for click action
  const linkTab = notif.link_tab;
  let linkData: any = null;
  try { linkData = notif.link_data ? (typeof notif.link_data === "string" ? JSON.parse(notif.link_data) : notif.link_data) : null; } catch (_) {}
  const params = new URLSearchParams();
  if (linkTab) params.set("tab", linkTab);
  if (linkData?.chatId) params.set("chatId", linkData.chatId);
  if (linkData?.aptId) params.set("aptId", linkData.aptId);
  if (childId) params.set("childId", childId);
  const url = "/?" + params.toString();
  // Tag for dedup
  const tag = linkData?.chatId ? "chat-" + linkData.chatId
    : linkData?.aptId ? "apt-" + linkData.aptId
    : childId ? type + "-" + childId
    : type;
  return { title, body: message, url, tag };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  // Supabase Database Webhook format: { type: "INSERT", table: "notifications", record: {...} }
  // Also support direct invocation: { user_id, type, message, ... }
  const notif = body.record || body;
  if (!notif?.user_id) {
    return new Response(JSON.stringify({ error: "Missing user_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Skip if notification is already read (rare but possible with rapid toggles)
  if (notif.read === true) {
    return new Response(JSON.stringify({ ok: true, skipped: "already_read" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check recipient's push notification preferences
  // Map notification type → pref key. Unmapped types always send.
  const typeToPrefKey: Record<string, string> = {
    message: "chat", chat: "chat",
    report: "reports",
    homework: "homework",
    appointments: "appointments", appointment_declined: "appointments",
    consult: "consult",
  };
  const prefKey = typeToPrefKey[notif.type];
  if (prefKey) {
    try {
      const { data: profile } = await supa
        .from("profiles")
        .select("notif_prefs")
        .eq("id", notif.user_id)
        .maybeSingle();
      if (profile?.notif_prefs && profile.notif_prefs[prefKey] === false) {
        return new Response(JSON.stringify({ ok: true, skipped: "user_pref_off", prefKey }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.error("❌ prefs lookup:", e);
      // On error, fail open — send the push
    }
  }

  // Look up user's push subscriptions
  const { data: subs, error: lookupErr } = await supa
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", notif.user_id);

  if (lookupErr) {
    console.error("❌ subscription lookup:", lookupErr);
    return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!subs?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_subscriptions" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const payload = buildPayload(notif);
  const payloadJson = JSON.stringify(payload);

  let sent = 0;
  let removed = 0;

  // Send to each endpoint; clean up expired ones (410/404)
  await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadJson
      );
      sent++;
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired — remove it
        try {
          await supa.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          removed++;
        } catch (e) { console.error("❌ cleanup:", e); }
      } else {
        console.error(`❌ push send failed (${statusCode}):`, err?.message || err);
      }
    }
  }));

  console.log(`📬 Push sent to user ${notif.user_id}: ${sent} delivered, ${removed} expired removed`);
  return new Response(JSON.stringify({ ok: true, sent, removed }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
