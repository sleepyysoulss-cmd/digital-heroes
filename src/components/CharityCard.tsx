import { Link } from "react-router-dom"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]

/** Charity photo, or a quiet pine-toned initial when no image is set. */
export function CharityImage({ charity, className = "" }: { charity: Charity; className?: string }) {
  if (charity.image_url) {
    return (
      <img
        src={charity.image_url}
        alt={charity.name}
        loading="lazy"
        className={`object-cover ${className}`}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-secondary font-serif text-6xl italic text-primary/50 ${className}`}
    >
      {charity.name.charAt(0)}
    </div>
  )
}

export default function CharityCard({ charity }: { charity: Charity }) {
  return (
    <Link
      to={`/charities/${charity.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
    >
      <CharityImage charity={charity} className="h-40 w-full" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="hover-underline w-fit font-medium leading-snug">{charity.name}</h3>
          {charity.is_featured && (
            <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs gold-ink">
              Featured
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {charity.description ?? "No description yet."}
        </p>
      </div>
    </Link>
  )
}
