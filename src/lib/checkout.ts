import { supabase } from "@/lib/supabaseClient"

type FunctionReply = { url?: string; error?: string }

// Calls a Stripe-related edge function (supabase-js attaches the user's JWT)
// and redirects the browser to the Stripe-hosted page it returns.
async function redirectFromFunction(name: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<FunctionReply>(name, { body })

  if (error) {
    // Edge function errors carry our JSON message in the response body.
    let message = error.message
    const response = (error as { context?: Response }).context
    if (response && typeof response.json === "function") {
      try {
        const payload = (await response.json()) as FunctionReply
        if (payload?.error) message = payload.error
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message)
  }
  if (!data?.url) throw new Error(data?.error ?? "No redirect URL returned.")
  window.location.href = data.url
}

export function startCheckout(plan: "monthly" | "yearly") {
  return redirectFromFunction("create-checkout-session", { plan })
}

/** One-off donation, not tied to gameplay (PRD section 08.1). `amount` is in major units. */
export function startDonation(charityId: string, amount: number) {
  return redirectFromFunction("create-donation-session", { charity_id: charityId, amount })
}

/** Stripe billing portal: update card, cancel, view invoices. */
export function openBillingPortal() {
  return redirectFromFunction("create-portal-session")
}
