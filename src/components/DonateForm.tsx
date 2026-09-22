import { useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { startDonation } from "@/lib/checkout"
import { formatMoney } from "@/lib/format"
import { Button } from "@/components/ui/button"

const PRESETS = [5, 10, 25, 50]

/** Independent donation: a one-off gift to a charity, separate from the subscription. */
export default function DonateForm({ charityId }: { charityId: string }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState<number>(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/login" className="text-primary underline underline-offset-4">
          Log in
        </Link>{" "}
        to make a one-off donation.
      </p>
    )
  }

  async function donate() {
    setError(null)
    if (!Number.isFinite(amount) || amount < 1) {
      setError("Enter an amount of at least 1.")
      return
    }
    setBusy(true)
    try {
      await startDonation(charityId, amount)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              amount === preset
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {formatMoney(preset)}
          </button>
        ))}
        <input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="Custom donation amount"
          className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" className="self-start" disabled={busy} onClick={donate}>
        {busy ? "Redirecting to Stripe..." : `Donate ${formatMoney(amount)}`}
      </Button>
    </div>
  )
}
