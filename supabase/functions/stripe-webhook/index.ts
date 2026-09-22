// Handles Stripe webhook events and keeps subscriptions/donations in sync.
// Called directly by Stripe (no user JWT), so it MUST be deployed with JWT
// verification OFF (see supabase/config.toml [functions.stripe-webhook]):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_SERVICE_ROLE_KEY   (server-only, bypasses RLS - never expose to the frontend)
// SUPABASE_URL is injected automatically.
//
// Subscribe this endpoint to these events in the Stripe dashboard:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted

import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@17"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })

// Bypasses RLS entirely. Only ever used server-side, never sent to the browser.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    )
  } catch (err) {
    console.error("Webhook signature verification failed", err)
    return new Response("Invalid signature", { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        if (!userId) break

        if (session.mode === "payment" && session.metadata?.contribution_type === "independent_donation") {
          // One-off donation (PRD 08.1), not tied to any subscription.
          const charityId = session.metadata?.charity_id
          if (charityId) {
            await supabaseAdmin.from("donations").insert({
              user_id: userId,
              charity_id: charityId,
              amount: (session.amount_total ?? 0) / 100,
              contribution_type: "independent_donation",
              stripe_ref: session.id,
            })
          }
          break
        }

        if (session.mode === "subscription" && session.subscription) {
          const plan = session.metadata?.plan as "monthly" | "yearly" | undefined
          const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
          const item = stripeSub.items.data[0]

          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: stripeSub.id,
              plan: plan ?? "monthly",
              status: mapStatus(stripeSub.status),
              amount_cents: item?.price?.unit_amount ?? null,
              currency: item?.price?.currency ?? "usd",
              current_period_start: toIso(stripeSub.current_period_start),
              current_period_end: toIso(stripeSub.current_period_end),
            },
            { onConflict: "stripe_subscription_id" }
          )

          // The subscription pledge: charity_percentage of one period's amount,
          // recorded once per Checkout session so it is not double-counted on renewal.
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("charity_id, charity_percentage")
            .eq("id", userId)
            .maybeSingle()
          if (profile?.charity_id && item?.price?.unit_amount) {
            const amount = (item.price.unit_amount / 100) * (Number(profile.charity_percentage) / 100)
            await supabaseAdmin.from("donations").insert({
              user_id: userId,
              charity_id: profile.charity_id,
              amount,
              contribution_type: "subscription_pledge",
              stripe_ref: session.id,
            })
          }
        }
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: mapStatus(sub.status),
            current_period_start: toIso(sub.current_period_start),
            current_period_end: toIso(sub.current_period_end),
            canceled_at: sub.canceled_at ? toIso(sub.canceled_at) : null,
          })
          .eq("stripe_subscription_id", sub.id)
        break
      }

      default:
        break
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error("Webhook handler error", err)
    return new Response("Webhook handler error", { status: 500 })
  }
})

function mapStatus(stripeStatus: Stripe.Subscription.Status) {
  switch (stripeStatus) {
    case "active": return "active"
    case "trialing": return "trialing"
    case "past_due":
    case "unpaid": return "past_due"
    case "canceled": return "canceled"
    default: return "inactive"
  }
}

function toIso(unixSeconds: number | null) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null
}
