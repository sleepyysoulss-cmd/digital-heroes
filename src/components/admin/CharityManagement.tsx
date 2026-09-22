import { useEffect, useState, type FormEvent } from "react"
import { supabase } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]
type CharityEvent = Database["public"]["Tables"]["charity_events"]["Row"]

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

type Form = {
  name: string
  description: string
  image_url: string
  website_url: string
  is_featured: boolean
  is_active: boolean
}

const EMPTY: Form = {
  name: "",
  description: "",
  image_url: "",
  website_url: "",
  is_featured: false,
  is_active: true,
}

function EventsEditor({ charityId }: { charityId: string }) {
  const [events, setEvents] = useState<CharityEvent[]>([])
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from("charity_events")
      .select("*")
      .eq("charity_id", charityId)
      .order("event_date")
    setEvents(data ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charityId])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !date) {
      setError("Give the event a title and a date.")
      return
    }
    const { error: dbError } = await supabase.from("charity_events").insert({
      charity_id: charityId,
      title: title.trim(),
      event_date: date,
      location: location.trim() || null,
    })
    if (dbError) {
      setError(dbError.message)
      return
    }
    setTitle("")
    setDate("")
    setLocation("")
    load()
  }

  async function remove(id: string) {
    await supabase.from("charity_events").delete().eq("id", id)
    load()
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Upcoming events (for example golf days)</p>
      {events.length > 0 && (
        <ul className="mt-2 divide-y divide-border text-sm">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                {ev.title} <span className="text-muted-foreground">{formatDate(ev.event_date)}</span>
                {ev.location && <span className="text-muted-foreground">, {ev.location}</span>}
              </span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(ev.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" aria-label="Event title" className={`${fieldClass} max-w-52`} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Event date" className={`${fieldClass} max-w-40`} />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" aria-label="Event location" className={`${fieldClass} max-w-52`} />
        <Button size="sm" type="submit">
          Add event
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

/** PRD 11.3: add, edit, delete charities; manage content and media. */
export default function CharityManagement() {
  const [charities, setCharities] = useState<Charity[]>([])
  const [form, setForm] = useState<Form>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from("charities").select("*").order("name")
    setCharities(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(c: Charity) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      description: c.description ?? "",
      image_url: c.image_url ?? "",
      website_url: c.website_url ?? "",
      is_featured: c.is_featured,
      is_active: c.is_active,
    })
    setError(null)
    setMessage(null)
  }

  function reset() {
    setEditingId(null)
    setForm(EMPTY)
    setError(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!form.name.trim()) {
      setError("A charity needs a name.")
      return
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      website_url: form.website_url.trim() || null,
      is_featured: form.is_featured,
      is_active: form.is_active,
    }
    setSaving(true)
    const { error: dbError } = editingId
      ? await supabase.from("charities").update(payload).eq("id", editingId)
      : await supabase.from("charities").insert(payload)
    setSaving(false)
    if (dbError) {
      setError(dbError.code === "23505" ? "A charity with that name already exists." : dbError.message)
      return
    }
    setMessage(editingId ? "Charity updated." : "Charity added.")
    if (!editingId) setForm(EMPTY)
    load()
  }

  async function remove(c: Charity) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return
    setError(null)
    const { error: dbError } = await supabase.from("charities").delete().eq("id", c.id)
    if (dbError) {
      setError(
        dbError.code === "23503"
          ? `${c.name} has donations recorded, so it cannot be deleted. Untick "Visible to subscribers" instead.`
          : dbError.message
      )
      return
    }
    if (editingId === c.id) reset()
    load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Charity management</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Charity name"
            aria-label="Charity name"
            className={fieldClass}
          />
          <input
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            placeholder="Website URL"
            aria-label="Website URL"
            className={fieldClass}
          />
          <input
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="Image URL (paste a link to a photo)"
            aria-label="Image URL"
            className={`${fieldClass} md:col-span-2`}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            aria-label="Description"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="accent-[var(--sage)]"
            />
            Featured on the homepage
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="accent-[var(--sage)]"
            />
            Visible to subscribers
          </label>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add charity"}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {message && <p className="mt-3 text-sm text-primary">{message}</p>}

        {editingId && <EventsEditor charityId={editingId} />}

        <ul className="mt-6 divide-y divide-border">
          {charities.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="font-medium">{c.name}</span>
                {c.is_featured && <span className="ml-2 text-xs text-copper">Featured</span>}
                {!c.is_active && <span className="ml-2 text-xs text-muted-foreground">Hidden</span>}
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)}>
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
