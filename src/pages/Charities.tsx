import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import CharityCard from "@/components/CharityCard"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]

/** Public charity directory with search and a featured filter (PRD 08.2). */
export default function Charities() {
  const [charities, setCharities] = useState<Charity[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [featuredOnly, setFeaturedOnly] = useState(false)

  useEffect(() => {
    supabase
      .from("charities")
      .select("*")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name")
      .then(({ data }) => {
        setCharities(data ?? [])
        setLoading(false)
      })
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return charities.filter((c) => {
      if (featuredOnly && !c.is_featured) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)
    })
  }, [charities, query, featuredOnly])

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight">Charities you can support</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Pick one when you subscribe. You can change it whenever you like.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or cause"
            aria-label="Search charities"
            className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setFeaturedOnly((v) => !v)}
          aria-pressed={featuredOnly}
          className={`h-10 rounded-md border px-4 text-sm transition-colors ${
            featuredOnly
              ? "border-copper bg-copper/15 text-copper"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Featured only
        </button>
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading charities...</p>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No charities match your search. Clear the search or turn off the featured filter.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CharityCard key={c.id} charity={c} />
          ))}
        </div>
      )}
    </main>
  )
}
