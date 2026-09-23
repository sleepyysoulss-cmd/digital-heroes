import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { formatMoney } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AdminReport } from "@/lib/database.types"

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-3xl ${accent ? "gold-ink" : "text-primary"}`}>{value}</p>
    </div>
  )
}

/** PRD 11.5: totals are computed in SQL (admin_report), so they stay fast as data grows. */
export default function ReportsPanel() {
  const [report, setReport] = useState<AdminReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc("admin_report").then(({ data, error: rpcError }) => {
      if (rpcError) setError(rpcError.message)
      else setReport(data as AdminReport)
    })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reports and analytics</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!report && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
        {report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total users" value={report.total_users} />
              <Stat label="Active subscribers" value={report.active_subscribers} />
              <Stat label="Prize pool (published draws)" value={formatMoney(report.total_prize_pool)} accent />
              <Stat label="Charity contributions" value={formatMoney(report.charity_total)} />
              <Stat label="Draws published" value={report.draws_published} />
              <Stat label="Winners" value={report.winners_total} />
              <Stat label="Paid out" value={formatMoney(report.total_paid_out)} />
              <Stat label="Awaiting payout" value={formatMoney(report.total_pending_payout)} />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Charity contributions by source</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex justify-between">
                    <span>From subscriptions</span>
                    <span className="text-foreground">{formatMoney(report.charity_from_subscriptions)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Independent donations</span>
                    <span className="text-foreground">{formatMoney(report.charity_independent)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Jackpot rollovers so far</span>
                    <span className="text-foreground">{report.jackpot_rollovers}</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">By charity</p>
                {report.by_charity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contributions recorded yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {report.by_charity.map((row) => (
                      <li key={row.name} className="flex justify-between">
                        <span>{row.name}</span>
                        <span className="text-foreground">{formatMoney(row.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
