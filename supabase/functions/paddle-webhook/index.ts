// Paddle Webhook Handler — Supabase Edge Function
// Receives webhook events from Paddle and updates the subscriptions table.
// Deploy: npx supabase functions deploy paddle-webhook --project-ref smgbojgrdezasxciloll

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Constants ─────────────────────────────────────────────────────────────────
const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "PADDLE_WEBHOOK_SECRET_PLACEHOLDER";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://smgbojgrdezasxciloll.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Service-role client bypasses RLS
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Signature Verification ────────────────────────────────────────────────────
// Paddle v2 sends: Paddle-Signature: ts=<timestamp>;h1=<hmac-sha256-hex>
async function verifySignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  if (PADDLE_WEBHOOK_SECRET === "PADDLE_WEBHOOK_SECRET_PLACEHOLDER") {
    console.error("❌ paddle-webhook: missing PADDLE_WEBHOOK_SECRET env var");
    return false;
  }
  if (!signatureHeader) {
    console.error("❌ paddle-webhook: missing Paddle-Signature header");
    return false;
  }

  try {
    const parts: Record<string, string> = {};
    signatureHeader.split(";").forEach((p) => {
      const [k, v] = p.split("=");
      if (k && v) parts[k.trim()] = v.trim();
    });

    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;

    // Paddle signs: ts + ":" + rawBody — verify with Web Crypto API (built-in, no imports)
    const signedPayload = `${ts}:${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(PADDLE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

    return expectedSig === h1;
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

// ─── Event Handlers ────────────────────────────────────────────────────────────

async function handleSubscriptionActivated(data: any) {
  const paddleSubId = data.id;
  const paddleCustId = data.customer_id;
  const customData = data.custom_data || {};
  const userId = customData.user_id;
  const householdId = customData.household_id;
  const plan = customData.plan || "family"; // Default to 'family' for backward compat
  const billingCycle = data.billing_cycle?.interval === "year" ? "yearly" : "monthly";
  const periodEnd = data.current_billing_period?.ends_at || null;
  const cancelUrl = data.management_urls?.cancel || null;

  if (!userId) {
    console.error("❌ subscription.activated: no user_id in custom_data");
    return;
  }

  console.log(`✅ Activating subscription for user ${userId}, plan ${plan}, household ${householdId}`);

  // Update the paying user's own subscription row — filter by plan to avoid hitting other plan rows
  const { error } = await supa
    .from("subscriptions")
    .update({
      status: "active",
      paddle_subscription_id: paddleSubId,
      paddle_customer_id: paddleCustId,
      billing_cycle: billingCycle,
      current_period_ends_at: periodEnd,
      household_id: householdId,
      cancel_url: cancelUrl,
    })
    .eq("user_id", userId)
    .eq("plan", plan);

  if (error) {
    console.error("❌ Failed to activate subscription:", error);
    return;
  }

  // Also activate all household members — only for 'family' plan (never touch specialist_ai rows)
  if (householdId && plan === "family") {
    const { error: hhError } = await supa
      .from("subscriptions")
      .update({
        status: "active",
        billing_cycle: billingCycle,
        current_period_ends_at: periodEnd,
        household_id: householdId,
      })
      .eq("household_id", householdId)
      .eq("plan", "family")
      .neq("user_id", userId); // Don't double-update the paying user

    if (hhError) console.error("⚠️  Failed to activate household members:", hhError);
    else console.log(`✅ Activated all household members for household ${householdId}`);
  }
}

async function handleSubscriptionCancelled(data: any) {
  const paddleSubId = data.id;

  // Find the subscription row by paddle_subscription_id
  const { data: subs, error: findErr } = await supa
    .from("subscriptions")
    .select("user_id, household_id, plan")
    .eq("paddle_subscription_id", paddleSubId)
    .limit(1);
  const sub = subs?.[0] || null;

  if (findErr || !sub) {
    console.error("❌ subscription.cancelled: could not find subscription for paddle_id", paddleSubId, findErr);
    return;
  }

  const plan = sub.plan || "family";
  console.log(`⚠️  Cancelling subscription for user ${sub.user_id}, plan ${plan}, household ${sub.household_id}`);

  // Cancel household members only for 'family' plan — never touch specialist_ai rows
  if (sub.household_id && plan === "family") {
    const { error } = await supa
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("household_id", sub.household_id)
      .eq("plan", "family");

    if (error) console.error("❌ Failed to cancel household subscriptions:", error);
    else console.log(`✅ Cancelled all family subscriptions for household ${sub.household_id}`);
  } else {
    // No household_id or specialist plan — cancel just this specific row
    const { error } = await supa
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("paddle_subscription_id", paddleSubId);

    if (error) console.error("❌ Failed to cancel subscription:", error);
    else console.log(`✅ Cancelled subscription for user ${sub.user_id}, plan ${plan}`);
  }
}

async function handlePaymentFailed(data: any) {
  const paddleSubId = data.subscription_id || data.id;

  const { error } = await supa
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("paddle_subscription_id", paddleSubId);

  if (error) console.error("❌ Failed to set past_due:", error);
  else console.log(`⚠️  Set past_due for paddle subscription ${paddleSubId}`);
}

async function handleTransactionCompleted(data: any) {
  const paddleSubId = data.subscription_id;
  if (!paddleSubId) return; // One-time transactions don't have subscription_id

  const periodEnd = data.billing_period?.ends_at || null;
  if (!periodEnd) return;

  // Find the subscription row to get household_id and plan
  const { data: subs, error: findErr } = await supa
    .from("subscriptions")
    .select("household_id, plan")
    .eq("paddle_subscription_id", paddleSubId)
    .limit(1);
  if (findErr) {
    console.error("❌ transaction.completed lookup error:", findErr);
    return;
  }
  const sub = subs?.[0] || null;

  const plan = sub?.plan || "family";
  const updates: Record<string, any> = {
    current_period_ends_at: periodEnd,
    status: "active", // Payment succeeded → ensure active
  };

  // Update paying user's row
  const { error } = await supa
    .from("subscriptions")
    .update(updates)
    .eq("paddle_subscription_id", paddleSubId);

  if (error) console.error("❌ Failed to update period:", error);

  // Also update household members' period_ends_at — only for 'family' plan
  if (sub?.household_id && plan === "family") {
    await supa
      .from("subscriptions")
      .update({ current_period_ends_at: periodEnd, status: "active" })
      .eq("household_id", sub.household_id)
      .eq("plan", "family");
  }

  console.log(`✅ Updated billing period for paddle subscription ${paddleSubId}`);
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Paddle-Signature") || "";

  // Verify webhook signature
  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    console.error("❌ Invalid webhook signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.event_type;
  const data = event.data;

  console.log(`📬 Paddle webhook received: ${eventType}`);

  try {
    switch (eventType) {
      case "subscription.activated":
      case "subscription.resumed":
        await handleSubscriptionActivated(data);
        break;

      case "subscription.canceled":
      case "subscription.cancelled":
        await handleSubscriptionCancelled(data);
        break;

      case "subscription.past_due":
      case "subscription.payment_failed":
        await handlePaymentFailed(data);
        break;

      case "transaction.completed":
        await handleTransactionCompleted(data);
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${eventType}`);
    }
  } catch (e) {
    console.error(`❌ Error handling ${eventType}:`, e);
    // Still return 200 to prevent Paddle from retrying
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
