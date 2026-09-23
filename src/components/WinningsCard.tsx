import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { TIER_LABEL } from "@/lib/draws"
import { formatMonth, formatMoney } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/database.types"

type Winner = Database["public"]["Tables"]["winners"]["Row"]
type Draw = Database["public"]["Tables"]["draws"]["Row"]

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"]

/**
 * PRD 09 and 10: winnings overview, proof upload, and payment status.
 * Proof files go to the private "winner-proofs" storage bucket, in a folder
 * named after the user id (enforced by storage policies).
 */
export default function WinningsCard() {
  const { user } = useAuth()
  const [winners, setWinners] = useState<Winner[]>([])
  const [draws, setDraws] = useState<Record<string, Draw>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!user) return
    const { data: winnersData } = await supabase
      .from("winners")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setWinners(winnersData ?? [])

    const drawIds = Array.from(new Set((winnersData ?? []).map((w) => w.draw_id)))
    if (drawIds.length > 0) {
      const { data: drawsData } = await supabase.from("draws").select("*").in("id", drawIds)
      const map: Record<string, Draw> = {}
      for (const d of drawsData ?? []) map[d.id] = d
      setDraws(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function uploadProof(winner: Winner, file: File | undefined) {
    if (!file || !user) return
    setError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPG, WebP or PDF screenshot of your scores.")
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError("That file is over 5 MB. Upload a smaller screenshot.")
      return
    }

    setBusy(winner.id)
    const extension = file.name.split(".").pop() || "png"
    const path = `${user.id}/${winner.id}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from("winner-proofs")
      .upload(path, file, { contentType: file.type })
    if (uploadError) {
      setBusy(null)
      setError(uploadError.message)
      return
    }

    const { error: rpcError } = await supabase.rpc("submit_winner_proof", {
      p_winner_id: winner.id,
      p_proof_url: path,
    })
    setBusy(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    load()
  }

  const counted = winners.filter((w) => w.verification_status !== "rejected")
  const totalWon = counted.reduce((sum, w) => sum + Number(w.prize_amount), 0)
  const totalPaid = counted
    .filter((w) => w.payment_status === "paid")
    .reduce((sum, w) => sum + Number(w.prize_amount), 0)

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Winnings</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : winners.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No winnings yet. If you match three or more numbers in a published draw, your prize appears here.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Total won</p>
                <p className="font-serif text-4xl gold-ink">{formatMoney(totalWon)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid out</p>
                <p className="mt-1 text-lg font-medium">{formatMoney(totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Still to be paid</p>
                <p className="mt-1 text-lg font-medium">{formatMoney(totalWon - totalPaid)}</p>
              </div>
            </div>

            <ul className="mt-5 divide-y divide-border border-t border-border">
              {winners.map((w) => (
                <li key={w.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{formatMoney(w.prize_amount)}</span>{" "}
                      <span className="text-muted-foreground">
                        {TIER_LABEL[w.match_tier]}
                        {draws[w.draw_id] ? `, ${formatMonth(draws[w.draw_id].draw_month)}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Verification: {w.verification_status}. Payment: {w.payment_status}.
                    </span>
                  </div>

                  {w.verification_status === "pending" && (
                    <div className="mt-2">
                      {w.proof_url && (
                        <p className="mb-1 text-xs text-primary">
                          Proof received. An admin will review it. You can replace it until then.
                        </p>
                      )}
                      <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {w.proof_url ? "Replace proof:" : "Upload a screenshot of your scores to claim this prize:"}
                        </span>
                        <input
                          type="file"
                          accept={ALLOWED_TYPES.join(",")}
                          disabled={busy === w.id}
                          onChange={(e) => uploadProof(w, e.target.files?.[0])}
                          className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
                        />
                        {busy === w.id && <span>Uploading...</span>}
                      </label>
                    </div>
                  )}
                  {w.verification_status === "rejected" && (
                    <p className="mt-1 text-xs text-destructive">
                      This submission was rejected, so no prize will be paid.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
