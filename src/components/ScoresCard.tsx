import { useEffect, useState, type FormEvent } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { SCORES_KEPT, SCORE_MAX, SCORE_MIN } from "@/lib/config"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/database.types"

type ScoreRow = Database["public"]["Tables"]["scores"]["Row"]

const inputClass =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

/**
 * Score entry (PRD 05): Stableford 1-45, one score per date, newest first.
 * The rolling "keep only the latest 5" rule lives in the database
 * (trigger enforce_score_limit), so it cannot be bypassed from the browser.
 */
export default function ScoresCard() {
  const { user, isActiveSubscriber } = useAuth()
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState("")
  const [score, setScore] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  async function loadScores() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", user.id)
      .order("score_date", { ascending: false })
    setScores(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function resetForm() {
    setDate("")
    setScore("")
    setEditingId(null)
    setError(null)
  }

  function startEdit(row: ScoreRow) {
    setEditingId(row.id)
    setDate(row.score_date)
    setScore(String(row.score))
    setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const scoreNum = Number(score)
    if (!date) {
      setError("Pick the date you played.")
      return
    }
    if (!Number.isInteger(scoreNum) || scoreNum < SCORE_MIN || scoreNum > SCORE_MAX) {
      setError(`Score must be a whole number between ${SCORE_MIN} and ${SCORE_MAX}.`)
      return
    }
    if (!user) return

    setSaving(true)
    const { error: dbError } = editingId
      ? await supabase
          .from("scores")
          .update({ score: scoreNum, score_date: date })
          .eq("id", editingId)
      : await supabase
          .from("scores")
          .insert({ user_id: user.id, score: scoreNum, score_date: date })
    setSaving(false)

    if (dbError) {
      setError(
        dbError.code === "23505"
          ? "You already have a score for that date. Edit or delete it instead."
          : dbError.code === "42501"
            ? "Your subscription must be active to add scores."
            : dbError.message
      )
      return
    }

    resetForm()
    loadScores()
  }

  async function handleDelete(id: string) {
    setSaving(true)
    const { error: dbError } = await supabase.from("scores").delete().eq("id", id)
    setSaving(false)
    if (dbError) setError(dbError.message)
    else loadScores()
  }

  const showForm = isActiveSubscriber || editingId !== null

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Your scores</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="score-date">
                Date played
              </label>
              <input
                id="score-date"
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputClass} w-40`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="score-value">
                Stableford score ({SCORE_MIN}-{SCORE_MAX})
              </label>
              <input
                id="score-value"
                type="number"
                min={SCORE_MIN}
                max={SCORE_MAX}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {editingId ? "Save changes" : "Add score"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </form>
        )}

        {!isActiveSubscriber && !editingId && (
          <p className="mb-4 text-sm text-muted-foreground">
            Subscribe to log new scores. You can still edit or remove existing ones below.
          </p>
        )}

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading scores...</p>
        ) : scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scores yet. Add the date and score of your latest round to get started.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {scores.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full border border-primary/40 font-serif text-lg text-primary">
                    {row.score}
                  </span>
                  <span className="text-muted-foreground">{formatDate(row.score_date)}</span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(row.id)}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Newest first. Only your latest {SCORES_KEPT} scores are kept: adding another removes the oldest.
        </p>
      </CardContent>
    </Card>
  )
}
