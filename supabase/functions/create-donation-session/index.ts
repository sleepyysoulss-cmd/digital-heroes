// One-off donation to a charity, independent of any subscription (PRD 08.1).
// Deployed with JWT verification ON. Deploy with:
//   supabase functions deploy create-donation-session

import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@17"
import { corsHeaders, json } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })
const CURRENCY = (Deno.env.get("CURRENCY") ?? "usd").toLowerCase()

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

    const { charity_id, amount } = await req.json()
    const amountNum = Number(amount)
    if (!charity_id || !Number.isFinite(amountNum) || amountNum < 1) {
      return json({ error: "Provide a charity_id and an amount of at least 1." }, 400)
    }

    const { data: charity } = await supabase
      .from("charities")
      .select("id, name, is_active")
      .eq("id", charity_id)
      .maybeSingle()
    if (!charity || !charity.is_active) return json({ error: "Charity not found." }, 404)

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173"

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            unit_amount: Math.round(amountNum * 100),
            product_data: { name: `Donation to ${charity.name}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/charities/${charity_id}?donation=success`,
      cancel_url: `${siteUrl}/charities/${charity_id}?donation=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        charity_id,
        contribution_type: "independent_donation",
      },
    })

    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
