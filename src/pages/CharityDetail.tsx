import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { Calendar, ExternalLink, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { CharityImage } from "@/components/CharityCard"
import DonateForm from "@/components/DonateForm"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]
type CharityEvent = Database["public"]["Tables"]["charity_events"]["Row"]

export default function CharityDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { user, profile, refreshProfile } = useAuth()
  const [charity, setCharity] = useState<Charity | null>(null)
  const [events, setEvents] = useState<CharityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [charityResult, eventsResult] = await Promise.all([
        supabase.from("charities").select("*").eq("id", id!).maybeSingle(),
        supabase
          .from("charity_events")
          .select("*")
          .eq("charity_id", id!)
          .gte("event_date", new Date().toISOString().slice(0, 10))
          .order("event_date"),
      ])
      setCharity(charityResult.data ?? null)
      setEvents(eventsResult.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function chooseCharity() {
    if (!profile || !charity) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from("profiles")
      .update({ charity_id: charity.id })
      .eq("id", profile.id)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    await refreshProfile()
    setMessage("Saved. This is now your charity.")
  }

  if (loading) return <p className="px-6 py-20 text-center text-sm text-muted-foreground">Loading...</p>
  if (!charity) {
    return (
      <main className="px-6 py-20 text-center">
        <p className="text-muted-foreground">We could not find that charity.</p>
        <Link to="/charities" className="mt-3 inline-block text-primary underline underline-offset-4">
          Back to all charities
        </Link>
      </main>
    )
  }

  const isMine = profile?.charity_id === charity.id
  const donation = params.get("donation")

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/charities" className="text-sm text-muted-foreground hover:text-foreground">
        All charities
      </Link>

      {donation === "success" && (
        <p className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          Thank you. Your donation is on its way to {charity.name}.
        </p>
      )}
      {donation === "cancelled" && (
        <p className="mt-4 rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Donation cancelled. You were not charged.
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <CharityImage charity={charity} className="h-64 w-full" />
        <div className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{charity.name}</h1>
            {charity.is_featured && (
              <span className="rounded-full bg-copper/15 px-2.5 py-0.5 text-xs text-copper">Featured</span>
            )}
          </div>
          <p className="mt-4 whitespace-pre-line text-muted-foreground">{charity.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Button onClick={chooseCharity} disabled={saving || isMine}>
                {isMine ? "Your current charity" : saving ? "Saving..." : "Make this my charity"}
              </Button>
            ) : (
              <Button asChild>
                <Link to="/signup">Subscribe and support {charity.name}</Link>
              </Button>
            )}
            {charity.website_url && (
              <Button asChild variant="outline">
                <a href={charity.website_url} target="_blank" rel="noreferrer">
                  Visit website <ExternalLink />
                </a>
              </Button>
            )}
          </div>
          {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Upcoming events</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No events scheduled right now.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {events.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" aria-hidden="true" /> {formatDate(event.event_date)}
                  </p>
                  {event.location && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" /> {event.location}
                    </p>
                  )}
                  {event.description && <p className="mt-1 text-muted-foreground">{event.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Give directly</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            A one-off donation that has nothing to do with the draw.
          </p>
          <DonateForm charityId={charity.id} />
        </section>
      </div>
    </main>
  )
}
