// Opens the Stripe billing portal so a subscriber can update their card,
// see invoices, or cancel. Deployed with JWT verification ON. Deploy with:
//   supabase functions deploy create-portal-session

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

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub?.stripe_customer_id) return json({ error: "No billing account on file yet." }, 404)

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173"
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl}/dashboard`,
    })

    return json({ url: portal.url })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
