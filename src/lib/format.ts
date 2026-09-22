import { CURRENCY } from "@/lib/config"

/** Accepts "YYYY-MM-DD" (treated as a local calendar date) or a full ISO timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-"
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function formatMonth(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}

export function formatMoney(value: number | string | null | undefined, currency = CURRENCY): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number.isFinite(n) ? n : 0)
}

/** First day of the month as "YYYY-MM-01" (local time). */
export function monthStart(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

export function addMonths(monthIso: string, n: number): string {
  const [y, m] = monthIso.split("-").map(Number)
  return monthStart(new Date(y, m - 1 + n, 1))
}
