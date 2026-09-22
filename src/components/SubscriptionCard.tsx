import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { openBillingPortal, startCheckout } from "@/lib/checkout"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  inactive: "Inactive",
}

export default function SubscriptionCard() {
  const { profile, subscription, isActiveSubscriber, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState<"monthly" | "yearly" | "portal" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const returnedFromStripe = params.get("checkout") === "success"

  // The Stripe webhook can land a few seconds after the redirect, so poll briefly.
  useEffect(() => {
    if (!returnedFromStripe || isActiveSubscriber) return
    let tries = 0
    const timer = setInterval(() => {
      tries++
      refreshProfile()
      if (tries >= 10) clearInterval(timer)
    }, 2500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedFromStripe, isActiveSubscriber])

  const hasCharity = Boolean(profile?.charity_id)
  const status = isActiveSubscriber ? "active" : (subscription?.status ?? "inactive")
  const endsSoon = isActiveSubscriber && Boolean(subscription?.canceled_at)

  async function run(kind: "monthly" | "yearly" | "portal") {
    setError(null)
    setBusy(kind)
    try {
      if (kind === "portal") await openBillingPortal()
      else await startCheckout(kind)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          <span className={`font-medium ${isActiveSubscriber ? "text-primary" : "text-foreground"}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </p>

        {subscription && isActiveSubscriber && (
          <p className="mt-1 text-sm text-muted-foreground">
            {subscription.plan === "yearly" ? "Yearly" : "Monthly"} plan.{" "}
            {endsSoon ? "Ends on " : "Renews on "}
            <span className="text-foreground">{formatDate(subscription.current_period_end)}</span>
          </p>
        )}

        {!isActiveSubscriber && subscription?.current_period_end && (
          <p className="mt-1 text-sm text-muted-foreground">
            Last plan ended {formatDate(subscription.current_period_end)}.
          </p>
        )}

        {returnedFromStripe && !isActiveSubscriber && (
          <p className="mt-3 text-sm text-primary">Payment received. Activating your plan...</p>
        )}

        {!isActiveSubscriber && (
          <div className="mt-4">
            {!hasCharity && (
              <p className="mb-2 text-sm text-copper">Choose your charity first, then pick a plan.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy !== null || !hasCharity} onClick={() => run("monthly")}>
                {busy === "monthly" ? "Redirecting..." : "Subscribe monthly"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !hasCharity}
                onClick={() => run("yearly")}
              >
                {busy === "yearly" ? "Redirecting..." : "Subscribe yearly (discounted)"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Without an active plan you can view the platform but not log scores or enter draws.
            </p>
          </div>
        )}

        {subscription?.stripe_customer_id && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 -ml-3"
            disabled={busy !== null}
            onClick={() => run("portal")}
          >
            {busy === "portal" ? "Opening..." : "Manage billing or cancel"}
          </Button>
        )}

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
