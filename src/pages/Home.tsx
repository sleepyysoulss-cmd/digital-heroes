import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, CreditCard, HeartHandshake, ListChecks, Trophy } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import CharityCard, { CharityImage } from "@/components/CharityCard"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]

const SAMPLE_SCORES = [32, 28, 41, 19, 36]

const STEPS = [
  {
    icon: CreditCard,
    title: "Subscribe",
    body: "Pick a monthly or yearly plan. It unlocks score entry and the monthly draw.",
  },
  {
    icon: HeartHandshake,
    title: "Choose your cause",
    body: "At least 10% of your subscription goes to the charity you select. Give more whenever you like.",
  },
  {
    icon: ListChecks,
    title: "Log your last five scores",
    body: "Enter Stableford scores from 1 to 45. Only your latest five count, oldest ones drop off automatically.",
  },
  {
    icon: Trophy,
    title: "Enter the monthly draw",
    body: "Your five scores are your numbers. Match three, four or five of the winning numbers to win.",
  },
]

const TIERS = [
  { match: "5 numbers", share: "40%", note: "Jackpot. If nobody wins it, it rolls into next month.", jackpot: true },
  { match: "4 numbers", share: "35%", note: "Split equally between everyone who matches four.", jackpot: false },
  { match: "3 numbers", share: "25%", note: "Split equally between everyone who matches three.", jackpot: false },
]

export default function Home() {
  const { user } = useAuth()
  const [charities, setCharities] = useState<Charity[]>([])

  useEffect(() => {
    supabase
      .from("charities")
      .select("*")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name")
      .limit(4)
      .then(({ data }) => setCharities(data ?? []))
  }, [])

  const spotlight = charities[0]
  const others = charities.slice(1)
  const ctaTarget = user ? "/dashboard" : "/signup"

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-card"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          <div>
            <h1 className="rise max-w-xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Every round you play sends money to a cause you chose.
            </h1>
            <p className="rise mt-6 max-w-lg text-lg text-muted-foreground" style={{ ["--d" as string]: "120ms" }}>
              Subscribe, log your latest Stableford scores, and a share of your subscription goes
              to your charity. Those same scores enter you into a monthly prize draw.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "240ms" }}>
              <Button asChild size="lg" className="bg-copper text-background hover:bg-copper/90">
                <Link to={ctaTarget}>
                  {user ? "Go to your dashboard" : "Subscribe and pick a charity"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/charities">See the charities</Link>
              </Button>
            </div>
          </div>

          {/* The draw, shown rather than described */}
          <div className="relative rounded-2xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur">
            <p className="text-sm text-muted-foreground">Your numbers this month</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {SAMPLE_SCORES.map((n, i) => (
                <span
                  key={n}
                  className="orb-drop flex size-14 items-center justify-center rounded-full border border-primary/40 bg-background font-serif text-2xl text-primary"
                  style={{ ["--d" as string]: `${400 + i * 130}ms` }}
                >
                  {n}
                </span>
              ))}
            </div>

            <div className="mt-8">
              <div className="flex items-baseline justify-between text-sm">
                <span>Your charity share</span>
                <span className="font-semibold text-copper">10% and up</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="bar-fill h-full w-1/5 rounded-full bg-copper"
                  style={{ ["--d" as string]: "1100ms" }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Set it at signup and raise it any time from your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="lift rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <step.icon className="size-6 text-primary" aria-hidden="true" />
                <span className="font-serif text-3xl text-muted-foreground/60">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Charity spotlight */}
      {spotlight && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
            Where the money goes
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Link
              to={`/charities/${spotlight.id}`}
              className="lift group grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-2"
            >
              <CharityImage charity={spotlight} className="h-56 w-full sm:h-full" />
              <div className="flex flex-col justify-center gap-3 p-8">
                <span className="w-fit rounded-full bg-copper/15 px-2.5 py-0.5 text-xs text-copper">
                  Featured charity
                </span>
                <h3 className="text-2xl font-semibold">{spotlight.name}</h3>
                <p className="text-muted-foreground">{spotlight.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
                  Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
            <div className="grid gap-4">
              {others.slice(0, 2).map((c) => (
                <CharityCard key={c.id} charity={c} />
              ))}
            </div>
          </div>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/charities">Browse every charity</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Prize tiers */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
          How the prize pool is shared
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          A fixed part of every subscription goes into the pool. Each month we draw five numbers
          between 1 and 45 and compare them with your five scores.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.match}
              className={`rounded-xl border p-6 ${
                tier.jackpot ? "border-copper/60 bg-copper/10" : "border-border bg-card"
              }`}
            >
              <p className="text-sm text-muted-foreground">Match {tier.match}</p>
              <p className={`mt-2 font-serif text-5xl ${tier.jackpot ? "text-copper" : "text-primary"}`}>
                {tier.share}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{tier.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Start with one round and one cause.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create your account, choose a charity, and you are in next month's draw.
          </p>
          <Button asChild size="lg" className="mt-6 bg-copper text-background hover:bg-copper/90">
            <Link to={ctaTarget}>{user ? "Go to your dashboard" : "Subscribe now"}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
