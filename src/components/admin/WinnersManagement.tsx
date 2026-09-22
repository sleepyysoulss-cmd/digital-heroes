import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { TIER_LABEL } from "@/lib/draws"
import { formatMonth, formatMoney } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/database.types"

type Winner = Database["public"]["Tables"]["winners"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Draw = Database["public"]["Tables"]["draws"]["Row"]

type Filter = "all" | "pending" | "approved" | "rejected" | "unpaid"

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

/** PRD 09 and 11.4: full winners list, verify submissions, mark payouts. */
export default function WinnersManagement() {
  const { user } = useAuth()
  const [winners, setWinners] = useState<Winner[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [draws, setDraws] = useState<Record<string, Draw>>({})
  const [filter, setFilter] = useState<Filter>("all")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: winnersError } = await supabase
      .from("winners")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
    if (winnersError) {
      setError(winnersError.message)
      setLoading(false)
      return
    }
    const rows = data ?? []
    setWinners(rows)

    const userIds = Array.from(new Set(rows.map((w) => w.user_id)))
    const drawIds = Array.from(new Set(rows.map((w) => w.draw_id)))
    const [profilesResult, drawsResult] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("*").in("id", userIds) : Promise.resolve({ data: [] as Profile[] }),
      drawIds.length ? supabase.from("draws").select("*").in("id", drawIds) : Promise.resolve({ data: [] as Draw[] }),
    ])
    const profileMap: Record<string, Profile> = {}
    for (const p of profilesResult.data ?? []) profileMap[p.id] = p
    const drawMap: Record<string, Draw> = {}
    for (const d of drawsResult.data ?? []) drawMap[d.id] = d
    setProfiles(profileMap)
    setDraws(drawMap)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function update(id: string, patch: Database["public"]["Tables"]["winners"]["Update"]) {
    setError(null)
    setBusy(id)
    const { error: updateError } = await supabase.from("winners").update(patch).eq("id", id)
    setBusy(null)
    if (updateError) {
      setError(updateError.message)
      return
    }
    load()
  }

  async function viewProof(path: string) {
    // Open the tab first (inside the click) so popup blockers allow it.
    const tab = window.open("", "_blank")
    if (/^https?:\/\//.test(path)) {
      if (tab) tab.location.href = path
      return
    }
    const { data, error: signError } = await supabase.storage.from("winner-proofs").createSignedUrl(path, 600)
    if (signError || !data) {
      tab?.close()
      setError(signError?.message ?? "Could not open the proof file.")
      return
    }
    if (tab) tab.location.href = data.signedUrl
  }

  const visible = winners.filter((w) => {
    if (filter === "all") return true
    if (filter === "unpaid") return w.verification_status === "approved" && w.payment_status === "pending"
    return w.verification_status === filter
  })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Winners management</CardTitle>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter winners"
          className={selectClass}
        >
          <option value="all">All winners</option>
          <option value="pending">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="unpaid">Approved, unpaid</option>
          <option value="rejected">Rejected</option>
        </select>
      </CardHeader>
      <CardContent className="pb-6">
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading winners...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {winners.length === 0 ? "No winners yet. Publish a draw first." : "No winners match this filter."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((w) => {
              const person = profiles[w.user_id]
              return (
                <li key={w.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{person?.full_name ?? person?.email ?? w.user_id}</span>
                      {person?.full_name && <span className="ml-2 text-muted-foreground">{person.email}</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(w.prize_amount)}, {TIER_LABEL[w.match_tier]}
                      {draws[w.draw_id] ? `, ${formatMonth(draws[w.draw_id].draw_month)}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verification: {w.verification_status}. Payment: {w.payment_status}.{" "}
                    {w.proof_url ? (
                      <button
                        type="button"
                        onClick={() => viewProof(w.proof_url!)}
                        className="text-primary underline underline-offset-4"
                      >
                        View proof
                      </button>
                    ) : (
                      "No proof uploaded yet."
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {w.verification_status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy === w.id || !w.proof_url}
                          onClick={() =>
                            update(w.id, {
                              verification_status: "approved",
                              verified_by: user?.id ?? null,
                              verified_at: new Date().toISOString(),
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === w.id}
                          onClick={() =>
                            update(w.id, {
                              verification_status: "rejected",
                              verified_by: user?.id ?? null,
                              verified_at: new Date().toISOString(),
                            })
                          }
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {w.verification_status === "approved" && w.payment_status === "pending" && (
                      <Button
                        size="sm"
                        className="bg-copper text-background hover:bg-copper/90"
                        disabled={busy === w.id}
                        onClick={() => update(w.id, { payment_status: "paid", paid_at: new Date().toISOString() })}
                      >
                        Mark as paid
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
