import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  fetchDraws,
  fetchTierCounts,
  publishDraw,
  simulateDraw,
  TIERS,
  TIER_LABEL,
  type Draw,
} from "@/lib/draws"
import { formatMoney, formatMonth, monthStart } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DrawType, MatchTier } from "@/lib/database.types"

type Counts = { entries: number; five: number; four: number; three: number }

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function Balls({ numbers }: { numbers: number[] | null }) {
  if (!numbers || numbers.length === 0) return <span className="text-muted-foreground">-</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {numbers.map((n) => (
        <span
          key={n}
          className="flex size-8 items-center justify-center rounded-full border border-copper/60 bg-copper/10 font-serif text-base text-copper"
        >
          {n}
        </span>
      ))}
    </span>
  )
}

/** PRD 06 and 11.2: configure logic, run simulations, publish. */
export default function DrawManagement() {
  const [month, setMonth] = useState(monthStart().slice(0, 7)) // "YYYY-MM"
  const [type, setType] = useState<DrawType>("random")
  const [draw, setDraw] = useState<Draw | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [history, setHistory] = useState<Draw[]>([])
  const [busy, setBusy] = useState<"simulate" | "publish" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const monthIso = `${month}-01`

  async function loadDraw() {
    const { data } = await supabase.from("draws").select("*").eq("draw_month", monthIso).maybeSingle()
    setDraw(data ?? null)
    if (data) {
      setType(data.draw_type)
      setCounts(await fetchTierCounts(data.id))
    } else {
      setCounts(null)
    }
  }

  async function loadHistory() {
    try {
      setHistory(await fetchDraws())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load draws.")
    }
  }

  useEffect(() => {
    setNotice(null)
    loadDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  useEffect(() => {
    loadHistory()
  }, [])

  async function handleSimulate() {
    setError(null)
    setNotice(null)
    setBusy("simulate")
    try {
      await simulateDraw(monthIso, type)
      await loadDraw()
      await loadHistory()
      setNotice("Simulation saved. Subscribers cannot see it until you publish.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handlePublish() {
    if (!draw) return
    if (!window.confirm(`Publish the ${formatMonth(monthIso)} draw? This creates winners and cannot be undone.`)) return
    setError(null)
    setNotice(null)
    setBusy("publish")
    try {
      const { winners } = await publishDraw(draw.id)
      await loadDraw()
      await loadHistory()
      setNotice(`Published. ${winners} winner${winners === 1 ? "" : "s"} created.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing failed.")
    } finally {
      setBusy(null)
    }
  }

  const pool: Record<MatchTier, number> = {
    five: Number(draw?.five_match_pool ?? 0),
    four: Number(draw?.four_match_pool ?? 0),
    three: Number(draw?.three_match_pool ?? 0),
  }
  const published = draw?.status === "published"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Draw management</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="draw-month" className="text-xs text-muted-foreground">
              Draw month
            </label>
            <input
              id="draw-month"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className={selectClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="draw-type" className="text-xs text-muted-foreground">
              Draw logic
            </label>
            <select
              id="draw-type"
              value={type}
              disabled={published}
              onChange={(e) => setType(e.target.value as DrawType)}
              className={selectClass}
            >
              <option value="random">Random (standard lottery)</option>
              <option value="algorithmic">Algorithmic (weighted by score frequency)</option>
            </select>
          </div>
          <Button disabled={busy !== null || published} onClick={handleSimulate}>
            {busy === "simulate" ? "Simulating..." : draw ? "Re-run simulation" : "Run simulation"}
          </Button>
          <Button
            className="bg-copper text-background hover:bg-copper/90"
            disabled={busy !== null || draw?.status !== "simulated"}
            onClick={handlePublish}
          >
            {busy === "publish" ? "Publishing..." : "Publish results"}
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}

        {draw && draw.status !== "draft" && (
          <div className="mt-6 rounded-lg border border-border bg-background/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{formatMonth(draw.draw_month)}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  published ? "bg-primary/15 text-primary" : "bg-copper/15 text-copper"
                }`}
              >
                {published ? "Published" : "Simulated, not published"}
              </span>
            </div>

            <p className="mb-2 mt-4 text-xs text-muted-foreground">Winning numbers</p>
            <Balls numbers={draw.winning_numbers} />

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {TIERS.map((tier) => {
                const winners = counts?.[tier] ?? 0
                return (
                  <div key={tier} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">{TIER_LABEL[tier]}</p>
                    <p className="mt-1 font-medium">Pool {formatMoney(pool[tier])}</p>
                    <p className="text-muted-foreground">
                      {winners} winner{winners === 1 ? "" : "s"}
                      {winners > 0 && ` at ${formatMoney(Math.floor((pool[tier] / winners) * 100) / 100)} each`}
                    </p>
                  </div>
                )
              })}
            </div>

            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              <li>
                Active subscribers: {draw.total_active_subscribers ?? 0}. Entries with scores:{" "}
                {counts?.entries ?? 0}.
              </li>
              <li>Total pool this month: {formatMoney(draw.prize_pool_total)}.</li>
              {Number(draw.five_match_rollover_in) > 0 && (
                <li>Jackpot carried in from earlier months: {formatMoney(draw.five_match_rollover_in)}.</li>
              )}
              {draw.five_match_rollover_out && (
                <li className="text-copper">
                  Nobody matched 5 numbers, so the {formatMoney(pool.five)} jackpot rolls into the next draw.
                </li>
              )}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">All draws</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Month</th>
                    <th className="py-1 pr-4 font-normal">Logic</th>
                    <th className="py-1 pr-4 font-normal">Status</th>
                    <th className="py-1 pr-4 font-normal">Numbers</th>
                    <th className="py-1 font-normal">Pool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 pr-4">{formatMonth(d.draw_month)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{d.draw_type}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{d.status}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{(d.winning_numbers ?? []).join(", ") || "-"}</td>
                      <td className="py-2">{formatMoney(d.prize_pool_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
