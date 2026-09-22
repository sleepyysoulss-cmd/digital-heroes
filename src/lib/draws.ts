// Draw engine (PRD sections 06 and 07).
//
// Design decisions for the PRD's open questions:
//  * A subscriber's draw numbers are their latest stored Stableford scores
//    (1-45, up to 5). No separate "pick your numbers" flow is needed.
//  * The winning numbers are 5 distinct numbers from 1-45.
//  * Matches count DISTINCT numbers, so logging "30" five times cannot fake a jackpot.
//  * Prize pool = PRIZE_POOL_SHARE of every active subscription (yearly plans
//    counted as 1/12 per month), using the real Stripe amount stored on the
//    subscription row. Tier split is 40 / 35 / 25.
//  * The 5-match pool rolls over to the next published draw if nobody hits it.
//
// The flow is: simulate (repeatable, invisible to subscribers) -> publish (creates winners).

import { supabase } from "@/lib/supabaseClient"
import type { Database, DrawType, MatchTier } from "@/lib/database.types"
import {
  FALLBACK_MONTHLY_AMOUNT,
  FALLBACK_YEARLY_AMOUNT,
  PRIZE_POOL_SHARE,
  SCORES_KEPT,
  SCORE_MAX,
  SCORE_MIN,
  TIER_SHARES,
} from "@/lib/config"

type Tables = Database["public"]["Tables"]
export type Draw = Tables["draws"]["Row"]
type Subscription = Tables["subscriptions"]["Row"]
type EntryInsert = Tables["draw_entries"]["Insert"]
type WinnerInsert = Tables["winners"]["Insert"]

export const TIERS: MatchTier[] = ["five", "four", "three"]
export const TIER_LABEL: Record<MatchTier, string> = {
  five: "5-number match",
  four: "4-number match",
  three: "3-number match",
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- pure logic

/** Standard lottery draw: `count` distinct numbers, uniformly random. */
export function randomNumbers(count = 5): number[] {
  const pool = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => i + SCORE_MIN)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

/**
 * Algorithmic draw: numbers that appear in more subscribers' scores are more
 * likely to be drawn (weight = frequency + 0.1, so every number stays possible).
 * Sampled without replacement.
 */
export function weightedNumbers(frequency: Map<number, number>, count = 5): number[] {
  const candidates: { n: number; w: number }[] = []
  for (let n = SCORE_MIN; n <= SCORE_MAX; n++) {
    candidates.push({ n, w: (frequency.get(n) ?? 0) + 0.1 })
  }
  const picked: number[] = []
  for (let k = 0; k < count; k++) {
    const total = candidates.reduce((sum, c) => sum + c.w, 0)
    let r = Math.random() * total
    let index = candidates.length - 1
    for (let i = 0; i < candidates.length; i++) {
      r -= candidates[i].w
      if (r <= 0) {
        index = i
        break
      }
    }
    picked.push(candidates[index].n)
    candidates.splice(index, 1)
  }
  return picked.sort((a, b) => a - b)
}

/** How many DISTINCT entry numbers appear in the winning set. */
export function countMatches(entry: number[], winning: number[]): number {
  const win = new Set(winning)
  let matches = 0
  for (const n of new Set(entry)) if (win.has(n)) matches++
  return matches
}

export function tierFor(matches: number): MatchTier | null {
  if (matches >= 5) return "five"
  if (matches === 4) return "four"
  if (matches === 3) return "three"
  return null
}

/** What one subscription pays per month, in major currency units. */
export function monthlyAmount(sub: Pick<Subscription, "plan" | "amount_cents">): number {
  const major =
    sub.amount_cents != null
      ? sub.amount_cents / 100
      : sub.plan === "yearly"
        ? FALLBACK_YEARLY_AMOUNT
        : FALLBACK_MONTHLY_AMOUNT
  return sub.plan === "yearly" ? major / 12 : major
}

export function computePools(
  subs: Pick<Subscription, "plan" | "amount_cents">[],
  rolloverIn: number
) {
  const total = round2(subs.reduce((sum, s) => sum + monthlyAmount(s) * PRIZE_POOL_SHARE, 0))
  const fiveBase = round2(total * TIER_SHARES.five)
  const four = round2(total * TIER_SHARES.four)
  const three = round2(total - fiveBase - four) // remainder, so the tiers always add up
  return { total, five: round2(fiveBase + rolloverIn), four, three }
}

// ------------------------------------------------------------------ data access

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** PostgREST returns at most 1000 rows per request, so read big tables page by page. */
async function fetchAllRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return out
}

function isActive(sub: Subscription): boolean {
  return (
    sub.status === "active" &&
    (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now())
  )
}

async function getOrCreateDraw(month: string, type: DrawType): Promise<Draw> {
  const { data: existing, error } = await supabase
    .from("draws")
    .select("*")
    .eq("draw_month", month)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) {
    if (existing.status === "published") {
      throw new Error("This month's draw is already published and cannot be run again.")
    }
    return existing
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: created, error: createError } = await supabase
    .from("draws")
    .insert({ draw_month: month, draw_type: type, created_by: user?.id ?? null })
    .select("*")
    .single()
  if (createError || !created) throw new Error(createError?.message ?? "Could not create draw.")
  return created
}

/** Jackpot carried in from the most recent published draw that nobody won. */
async function rolloverInFor(month: string): Promise<number> {
  const { data, error } = await supabase
    .from("draws")
    .select("*")
    .eq("status", "published")
    .lt("draw_month", month)
    .order("draw_month", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.five_match_rollover_out ? Number(data.five_match_pool ?? 0) : 0
}

/**
 * Runs (or re-runs) the draw for `month` ("YYYY-MM-01") and stores the result
 * as status "simulated". Subscribers cannot see simulated draws; nothing is
 * paid out until publishDraw().
 */
export async function simulateDraw(month: string, type: DrawType): Promise<void> {
  const draw = await getOrCreateDraw(month, type)

  // 1. Everyone with an active subscription right now.
  const allActive = await fetchAllRows<Subscription>((from, to) =>
    supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .order("id")
      .range(from, to)
  )
  const activeSubs = allActive.filter(isActive)
  const userIds = Array.from(new Set(activeSubs.map((s) => s.user_id)))

  // 2. Each active subscriber's latest scores become their numbers.
  const numbersByUser = new Map<string, number[]>()
  for (const ids of chunk(userIds, 100)) {
    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .in("user_id", ids)
      .order("score_date", { ascending: false })
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const list = numbersByUser.get(row.user_id) ?? []
      if (list.length < SCORES_KEPT) {
        list.push(row.score)
        numbersByUser.set(row.user_id, list)
      }
    }
  }

  // 3. Winning numbers.
  let winning: number[]
  if (type === "algorithmic") {
    const frequency = new Map<number, number>()
    for (const numbers of numbersByUser.values()) {
      for (const n of new Set(numbers)) frequency.set(n, (frequency.get(n) ?? 0) + 1)
    }
    winning = weightedNumbers(frequency)
  } else {
    winning = randomNumbers()
  }

  // 4. Rebuild this draw's entries with their match tier.
  const entries: EntryInsert[] = []
  for (const [userId, numbers] of numbersByUser) {
    entries.push({
      draw_id: draw.id,
      user_id: userId,
      numbers,
      match_tier: tierFor(countMatches(numbers, winning)),
    })
  }
  const { error: clearError } = await supabase.from("draw_entries").delete().eq("draw_id", draw.id)
  if (clearError) throw new Error(clearError.message)
  for (const part of chunk(entries, 500)) {
    const { error } = await supabase.from("draw_entries").insert(part)
    if (error) throw new Error(error.message)
  }

  // 5. Pools (with jackpot rollover) and save.
  const rolloverIn = await rolloverInFor(month)
  const pools = computePools(activeSubs, rolloverIn)
  const hasJackpotWinner = entries.some((e) => e.match_tier === "five")

  const { error: updateError } = await supabase
    .from("draws")
    .update({
      draw_type: type,
      winning_numbers: winning,
      total_active_subscribers: userIds.length,
      prize_pool_total: pools.total,
      five_match_pool: pools.five,
      four_match_pool: pools.four,
      three_match_pool: pools.three,
      five_match_rollover_in: rolloverIn,
      five_match_rollover_out: !hasJackpotWinner,
      status: "simulated",
      simulated_at: new Date().toISOString(),
    })
    .eq("id", draw.id)
  if (updateError) throw new Error(updateError.message)
}

/** Turns a simulated draw into real winners and makes it visible to subscribers. */
export async function publishDraw(drawId: string): Promise<{ winners: number }> {
  const { data: draw, error: drawError } = await supabase
    .from("draws")
    .select("*")
    .eq("id", drawId)
    .single()
  if (drawError || !draw) throw new Error(drawError?.message ?? "Draw not found.")
  if (draw.status !== "simulated") throw new Error("Simulate the draw before publishing it.")

  const entries = await fetchAllRows<Tables["draw_entries"]["Row"]>((from, to) =>
    supabase
      .from("draw_entries")
      .select("*")
      .eq("draw_id", drawId)
      .not("match_tier", "is", null)
      .order("id")
      .range(from, to)
  )

  const byTier: Record<MatchTier, Tables["draw_entries"]["Row"][]> = { five: [], four: [], three: [] }
  for (const entry of entries) if (entry.match_tier) byTier[entry.match_tier].push(entry)

  const pool: Record<MatchTier, number> = {
    five: Number(draw.five_match_pool ?? 0),
    four: Number(draw.four_match_pool ?? 0),
    three: Number(draw.three_match_pool ?? 0),
  }

  // Each tier's pool is split equally between its winners (rounded down to the cent).
  const rows: WinnerInsert[] = []
  for (const tier of TIERS) {
    const winners = byTier[tier]
    if (winners.length === 0) continue
    const share = Math.floor((pool[tier] / winners.length) * 100) / 100
    for (const entry of winners) {
      rows.push({
        draw_id: drawId,
        user_id: entry.user_id,
        draw_entry_id: entry.id,
        match_tier: tier,
        prize_amount: share,
      })
    }
  }

  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from("winners").insert(part)
    if (error) throw new Error(error.message)
  }

  const { error: publishError } = await supabase
    .from("draws")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", drawId)
  if (publishError) throw new Error(publishError.message)

  return { winners: rows.length }
}

export async function fetchDraws(): Promise<Draw[]> {
  const { data, error } = await supabase
    .from("draws")
    .select("*")
    .order("draw_month", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Entry and winner counts for the admin's simulation preview. */
export async function fetchTierCounts(drawId: string) {
  async function count(tier?: MatchTier): Promise<number> {
    const base = supabase
      .from("draw_entries")
      .select("id", { count: "exact", head: true })
      .eq("draw_id", drawId)
    const { count: total, error } = tier ? await base.eq("match_tier", tier) : await base
    if (error) throw new Error(error.message)
    return total ?? 0
  }
  const [entries, five, four, three] = await Promise.all([
    count(),
    count("five"),
    count("four"),
    count("three"),
  ])
  return { entries, five, four, three }
}
