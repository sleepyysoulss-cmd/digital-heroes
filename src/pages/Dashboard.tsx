import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import SubscriptionCard from "@/components/SubscriptionCard"
import CharitySection from "@/components/CharitySection"
import ScoresCard from "@/components/ScoresCard"
import ParticipationCard from "@/components/ParticipationCard"
import WinningsCard from "@/components/WinningsCard"

/** PRD section 10: every required module lives on this page. */
export default function Dashboard() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const checkout = params.get("checkout")

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>

      {checkout === "cancelled" && (
        <p className="mb-6 rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Checkout cancelled. You were not charged.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SubscriptionCard />
        <CharitySection />
        <ScoresCard />
        <ParticipationCard />
        <WinningsCard />
      </div>
    </main>
  )
}
