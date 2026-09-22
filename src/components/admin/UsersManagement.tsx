import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { SCORE_MAX, SCORE_MIN } from "@/lib/config"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database, SubscriptionStatus, UserRole } from "@/lib/database.types"

type Tables = Database["public"]["Tables"]
type Profile = Tables["profiles"]["Row"]
type Subscription = Tables["subscriptions"]["Row"]
type Score = Tables["scores"]["Row"]
type Charity = Tables["charities"]["Row"]

const fieldClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

const STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due", "canceled", "inactive"]

function ScoreEditor({ score, onChanged }: { score: Score; onChanged: () => void }) {
  const [value, setValue] = useState(String(score.score))
  const [date, setDate] = useState(score.score_date)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const n = Number(value)
    if (!Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX) {
      setError(`Score must be ${SCORE_MIN}-${SCORE_MAX}.`)
      return
    }
    const { error: dbError } = await supabase
      .from("scores")
      .update({ score: n, score_date: date })
      .eq("id", score.id)
    if (dbError) setError(dbError.code === "23505" ? "That user already has a score on this date." : dbError.message)
    else onChanged()
  }

  async function remove() {
    const { error: dbError } = await supabase.from("scores").delete().eq("id", score.id)
    if (dbError) setError(dbError.message)
    else onChanged()
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <input
        type="number"
        min={SCORE_MIN}
        max={SCORE_MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Score"
        className={`${fieldClass} w-20`}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date"
        className={`${fieldClass} w-40`}
      />
      <Button size="sm" variant="outline" onClick={save}>
        Save
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={remove}>
        Delete
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </li>
  )
}

function UserEditor({
  user,
  sub,
  charities,
  isSelf,
  onChanged,
}: {
  user: Profile
  sub: Subscription | undefined
  charities: Charity[]
  isSelf: boolean
  onChanged: () => void
}) {
  const [fullName, setFullName] = useState(user.full_name ?? "")
  const [role, setRole] = useState<UserRole>(user.role)
  const [charityId, setCharityId] = useState(user.charity_id ?? "")
  const [percent, setPercent] = useState(String(user.charity_percentage))
  const [scores, setScores] = useState<Score[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadScores() {
    const { data } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", user.id)
      .order("score_date", { ascending: false })
    setScores(data ?? [])
  }

  useEffect(() => {
    loadScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function saveProfile() {
    setError(null)
    setMessage(null)
    const pct = Number(percent)
    if (!Number.isFinite(pct) || pct < 10 || pct > 100) {
      setError("Charity percentage must be between 10 and 100.")
      return
    }
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        role,
        charity_id: charityId || null,
        charity_percentage: pct,
      })
      .eq("id", user.id)
    if (dbError) setError(dbError.message)
    else {
      setMessage("Profile saved.")
      onChanged()
    }
  }

  async function setStatus(status: SubscriptionStatus) {
    setError(null)
    setMessage(null)
    const result = sub
      ? await supabase
          .from("subscriptions")
          .update({ status, canceled_at: status === "canceled" ? new Date().toISOString() : sub.canceled_at })
          .eq("id", sub.id)
      : await supabase.from("subscriptions").insert({ user_id: user.id, plan: "monthly", status })
    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "This user already has another active subscription."
          : result.error.message
      )
      return
    }
    setMessage("Subscription updated. Note: this changes the database only, not Stripe billing.")
    onChanged()
  }

  return (
    <div className="mt-3 grid gap-6 rounded-lg border border-border bg-background/40 p-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Profile</p>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          aria-label="Full name"
          className={fieldClass}
        />
        <select
          value={role}
          disabled={isSelf}
          onChange={(e) => setRole(e.target.value as UserRole)}
          aria-label="Role"
          className={fieldClass}
        >
          <option value="subscriber">Subscriber</option>
          <option value="admin">Administrator</option>
        </select>
        <select
          value={charityId}
          onChange={(e) => setCharityId(e.target.value)}
          aria-label="Charity"
          className={fieldClass}
        >
          <option value="">No charity chosen</option>
          {charities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Charity %
          <input
            type="number"
            min={10}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className={`${fieldClass} w-24`}
          />
        </label>
        <Button size="sm" className="self-start" onClick={saveProfile}>
          Save profile
        </Button>

        <p className="mt-2 text-sm font-medium">Subscription</p>
        <p className="text-xs text-muted-foreground">
          {sub
            ? `${sub.plan} plan, renews or ends ${formatDate(sub.current_period_end)}`
            : "No subscription on record."}
        </p>
        <select
          value={sub?.status ?? "inactive"}
          onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
          aria-label="Subscription status"
          className={fieldClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium">Golf scores</p>
        {scores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No scores logged.</p>
        ) : (
          <ul className="divide-y divide-border">
            {scores.map((s) => (
              <ScoreEditor key={s.id} score={s} onChanged={loadScores} />
            ))}
          </ul>
        )}
      </div>

      {(error || message) && (
        <p className={`text-sm md:col-span-2 ${error ? "text-destructive" : "text-primary"}`}>{error ?? message}</p>
      )}
    </div>
  )
}

/** PRD 11.1: view and edit profiles, edit scores, manage subscriptions. */
export default function UsersManagement() {
  const { user: me } = useAuth()
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<Profile[]>([])
  const [subs, setSubs] = useState<Record<string, Subscription>>({})
  const [charities, setCharities] = useState<Charity[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let request = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100)
    const term = query.trim().replace(/[,()%]/g, " ")
    if (term) request = request.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)

    const { data, error: loadError } = await request
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }
    const rows = data ?? []
    setUsers(rows)

    if (rows.length > 0) {
      const { data: subRows } = await supabase
        .from("subscriptions")
        .select("*")
        .in("user_id", rows.map((r) => r.id))
        .order("created_at", { ascending: true })
      const map: Record<string, Subscription> = {}
      for (const s of subRows ?? []) {
        // Later rows win, but an active subscription is never replaced by an older/inactive one.
        if (!map[s.user_id] || map[s.user_id].status !== "active" || s.status === "active") map[s.user_id] = s
      }
      setSubs(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase
      .from("charities")
      .select("*")
      .order("name")
      .then(({ data }) => setCharities(data ?? []))
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">User management</CardTitle>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search users"
          className={`${fieldClass} w-56`}
        />
      </CardHeader>
      <CardContent className="pb-6">
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match your search.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const sub = subs[u.id]
              const open = openId === u.id
              return (
                <li key={u.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : u.id)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm"
                  >
                    <span>
                      <span className="font-medium">{u.full_name ?? "(no name)"}</span>
                      <span className="ml-2 text-muted-foreground">{u.email}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {u.role === "admin" ? "Admin. " : ""}
                      {sub ? `${sub.plan}, ${sub.status}` : "No subscription"}
                    </span>
                  </button>
                  {open && (
                    <UserEditor
                      user={u}
                      sub={sub}
                      charities={charities}
                      isSelf={u.id === me?.id}
                      onChanged={load}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {users.length === 100 && (
          <p className="mt-3 text-xs text-muted-foreground">Showing the newest 100 users. Search to narrow down.</p>
        )}
      </CardContent>
    </Card>
  )
}
