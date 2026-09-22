// Creates a Stripe Checkout Session for a monthly or yearly subscription.
// Deployed with JWT verification ON (default): the caller must be a logged-in
// Supabase user. Deploy with:
//   supabase functions deploy create-checkout-session
//
// Required secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_MONTHLY   (Stripe Price ID, recurring monthly)
//   STRIPE_PRICE_YEARLY    (Stripe Price ID, recurring yearly)
//   SITE_URL               (e.g. https://your-app.vercel.app)
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@17"
import { corsHeaders, json } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return json({ error: "Not authenticated" }, 401)

    const { plan } = await req.json()
    if (plan !== "monthly" && plan !== "yearly") {
      return json({ error: "plan must be 'monthly' or 'yearly'" }, 400)
    }

    // A user may only have one row with status = 'active' (DB constraint), so
    // block a second checkout instead of letting Stripe create a subscription
    // the webhook can never save.
    const { data: existingActive } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("status", "active")
      .maybeSingle()
    if (existingActive) return json({ error: "You already have an active subscription." }, 409)

    const priceId =
      plan === "monthly"
        ? Deno.env.get("STRIPE_PRICE_MONTHLY")
        : Deno.env.get("STRIPE_PRICE_YEARLY")
    if (!priceId) return json({ error: "Price not configured" }, 500)

    // Reuse this user's Stripe customer id if we have one on file already.
    const { data: priorSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const customerId =
      priorSub?.stripe_customer_id ??
      (await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })).id

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    })

    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
