import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config"
import { monthlyAmount } from "@/lib/draws"
import { formatMoney } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import DonateForm from "@/components/DonateForm"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

export default function CharitySection() {
  const { profile, subscription, isActiveSubscriber, refreshProfile } = useAuth()
  const [charities, setCharities] = useState<Charity[]>([])
  const [charityId, setCharityId] = useState<string>("")
  const [percentage, setPercentage] = useState<number>(MIN_CHARITY_PERCENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from("charities")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setCharities(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (profile?.charity_id) setCharityId(profile.charity_id)
    if (profile?.charity_percentage) {
      setPercentage(Math.min(Number(profile.charity_percentage), MAX_CHARITY_PERCENT))
    }
  }, [profile])

  async function handleSave() {
    setError(null)
    setSaved(false)
    if (!charityId) {
      setError("Pick a charity first.")
      return
    }
    if (!profile) return
    setSaving(true)
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ charity_id: charityId, charity_percentage: percentage })
      .eq("id", profile.id)
    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  // Estimated per-month contribution, only when we know what the user pays.
  const estimate =
    subscription && isActiveSubscriber ? monthlyAmount(subscription) * (percentage / 100) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your charity</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading charities...</p>
        ) : charities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No charities available yet. Check back soon.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="charity-select">
                Recipient
              </label>
              <select
                id="charity-select"
                className={selectClass}
                value={charityId}
                onChange={(e) => setCharityId(e.target.value)}
              >
                <option value="" disabled>
                  Choose a charity
                </option>
                {charities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="charity-pct">
                Contribution: {percentage}% of your subscription
                {estimate !== null && ` (about ${formatMoney(estimate)} a month)`}
              </label>
              <input
                id="charity-pct"
                type="range"
                min={MIN_CHARITY_PERCENT}
                max={MAX_CHARITY_PERCENT}
                step={5}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="accent-[var(--sage)]"
              />
              <p className="text-xs text-muted-foreground">
                Minimum {MIN_CHARITY_PERCENT}%, up to {MAX_CHARITY_PERCENT}%.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-primary">Saved.</p>}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save charity choice"}
              </Button>
              {charityId && (
                <Link
                  to={`/charities/${charityId}`}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  View profile and events
                </Link>
              )}
            </div>

            {profile?.charity_id && (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Give an extra one-off gift</p>
                <DonateForm charityId={profile.charity_id} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
