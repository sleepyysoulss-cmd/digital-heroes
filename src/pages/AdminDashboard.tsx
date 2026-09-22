import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import ReportsPanel from "@/components/admin/ReportsPanel"
import UsersManagement from "@/components/admin/UsersManagement"
import DrawManagement from "@/components/admin/DrawManagement"
import CharityManagement from "@/components/admin/CharityManagement"
import WinnersManagement from "@/components/admin/WinnersManagement"

const TABS = [
  { id: "reports", label: "Reports", view: ReportsPanel },
  { id: "users", label: "Users", view: UsersManagement },
  { id: "draws", label: "Draws", view: DrawManagement },
  { id: "charities", label: "Charities", view: CharityManagement },
  { id: "winners", label: "Winners", view: WinnersManagement },
] as const

/** PRD section 11: five control surfaces. */
export default function AdminDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("reports")
  const Active = TABS.find((t) => t.id === tab)!.view

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Admin: {profile?.full_name ?? profile?.email}
      </h1>

      <div role="tablist" aria-label="Admin sections" className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <Active />
      </div>
    </main>
  )
}
