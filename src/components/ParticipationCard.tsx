import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { TIER_LABEL } from "@/lib/draws"
import { addMonths, formatMonth, monthStart } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/database.types"

type Draw = Database["public"]["Tables"]["draws"]["Row"]
type Entry = Database["public"]["Tables"]["draw_entries"]["Row"]

const chip =
  "inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium"

/** PRD 10: draws entered and upcoming draws. */
export default function ParticipationCard() {
  const { user, isActiveSubscriber } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [draws, setDraws] = useState<Record<string, Draw>>({})
  const [publishedMonths, setPublishedMonths] = useState<string[]>([])
  const [myNumbers, setMyNumbers] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      // Row-level security only returns entries and draws that are already published.
      const [entriesResult, drawsResult, scoresResult] = await Promise.all([
        supabase.from("draw_entries").select("*").eq("user_id", user!.id),
        supabase.from("draws").select("*").eq("status", "published").order("draw_month", { ascending: false }),
        supabase
          .from("scores")
          .select("*")
          .eq("user_id", user!.id)
          .order("score_date", { ascending: false })
          .limit(5),
      ])
      const map: Record<string, Draw> = {}
      for (const d of drawsResult.data ?? []) map[d.id] = d
      setDraws(map)
      setPublishedMonths((drawsResult.data ?? []).map((d) => d.draw_month))
      setEntries(entriesResult.data ?? [])
      setMyNumbers((scoresResult.data ?? []).map((s) => s.score))
      setLoading(false)
    }
    load()
  }, [user])

  const thisMonth = monthStart()
  const upcoming = publishedMonths.includes(thisMonth) ? addMonths(thisMonth, 1) : thisMonth

  const sortedEntries = [...entries]
    .filter((e) => draws[e.draw_id])
    .sort((a, b) => draws[b.draw_id].draw_month.localeCompare(draws[a.draw_id].draw_month))

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Draws</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Draws entered</p>
                <p className="font-serif text-4xl text-primary">{sortedEntries.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next draw</p>
                <p className="mt-1 text-lg font-medium">{formatMonth(upcoming)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your numbers for it</p>
                {myNumbers.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {myNumbers.map((n, i) => (
                      <span key={`${n}-${i}`} className={`${chip} border-primary/40 text-primary`}>
                        {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Log a score to get numbers.</p>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {!isActiveSubscriber
                ? "Subscribe to be entered into the next draw."
                : myNumbers.length === 0
                  ? "You are subscribed. Add at least one score to be entered."
                  : "You are entered. Numbers are taken from your latest scores when the draw runs."}
            </p>

            {sortedEntries.length > 0 && (
              <ul className="mt-5 divide-y divide-border border-t border-border">
                {sortedEntries.map((entry) => {
                  const draw = draws[entry.draw_id]
                  const winning = new Set(draw.winning_numbers ?? [])
                  return (
                    <li key={entry.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{formatMonth(draw.draw_month)}</span>
                        <span className={entry.match_tier ? "text-copper" : "text-muted-foreground"}>
                          {entry.match_tier ? TIER_LABEL[entry.match_tier] : "No match"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {[...new Set(entry.numbers)].map((n) => (
                          <span
                            key={n}
                            className={`${chip} ${
                              winning.has(n)
                                ? "border-copper bg-copper/20 text-copper"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {n}
                          </span>
                        ))}
                        <span className="ml-2 text-xs text-muted-foreground">
                          Drawn: {(draw.winning_numbers ?? []).join(", ")}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
