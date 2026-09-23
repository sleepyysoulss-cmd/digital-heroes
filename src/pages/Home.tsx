import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import CharityCard, { CharityImage } from "@/components/CharityCard"
import Magnetic from "@/components/motion/Magnetic"
import CountUp from "@/components/motion/CountUp"
import type { Database } from "@/lib/database.types"

type Charity = Database["public"]["Tables"]["charities"]["Row"]

const CARD_ROWS = [
  { round: "Round 1", score: 32 },
  { round: "Round 2", score: 28 },
  { round: "Round 3", score: 41 },
  { round: "Round 4", score: 19 },
  { round: "Round 5", score: 36 },
]
const TOTAL = CARD_ROWS.reduce((sum, r) => sum + r.score, 0)
const CHARITY_PERCENT = 12

const STEPS = [
  { title: "Subscribe", body: "Pick a monthly or yearly plan. It unlocks score entry and the monthly draw." },
  { title: "Choose your cause", body: "At least 10% of your subscription goes to the charity you select." },
  { title: "Log your last five scores", body: "Stableford, 1 to 45. Only your latest five count." },
  { title: "Enter the monthly draw", body: "Your five scores are your numbers. Match three or more to win." },
]

const TIERS = [
  { match: "5-number match", share: "40%", note: "the jackpot — rolls over if unclaimed", emphasis: true },
  { match: "4-number match", share: "35%", note: "split equally among everyone who matches four", emphasis: false },
  { match: "3-number match", share: "25%", note: "split equally among everyone who matches three", emphasis: false },
]

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.35 + i * 0.14, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] as const },
  }),
}

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
  const others = charities.slice(1, 3)
  const ctaTarget = user ? "/dashboard" : "/signup"
  const barDelay = 0.35 + CARD_ROWS.length * 0.14 + 0.15

  return (
    <main>
      {/* Hero — the one orchestrated moment on the page */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-28">
        <div>
          <h1 className="max-w-lg text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl">
            Every round you play sends money to a cause you chose.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Subscribe, log your latest Stableford scores, and a share of your subscription goes
            to your charity. Those same scores enter you into a monthly prize draw.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Magnetic strength={0.2}>
              <Button asChild size="lg" className="bg-pine text-primary-foreground hover:bg-pine/90">
                <Link to={ctaTarget}>
                  {user ? "Go to your dashboard" : "Subscribe and pick a charity"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Magnetic>
            <Link to="/charities" className="hover-underline text-sm text-foreground">
              See the charities
            </Link>
          </div>
        </div>

        {/* The scorecard: fills in once, on load. Nothing here repeats on scroll. */}
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">This month's card</p>
          <dl className="mt-4">
            {CARD_ROWS.map((row, i) => (
              <motion.div
                key={row.round}
                custom={i}
                initial="hidden"
                animate="show"
                variants={rowVariants}
                className="flex items-baseline justify-between rule-b py-2 text-sm first:pt-0 last:border-b-0"
              >
                <dt className="text-muted-foreground">{row.round}</dt>
                <dd className="tabular font-serif text-xl italic text-primary">{row.score}</dd>
              </motion.div>
            ))}
          </dl>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: barDelay - 0.1, duration: 0.4 }}
            className="mt-3 flex items-baseline justify-between border-t border-ink/15 pt-3 text-sm"
          >
            <span>Total</span>
            <CountUp value={TOTAL} delay={barDelay} className="text-lg font-medium" />
          </motion.div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Going to your charity</span>
              <span className="tabular font-medium gold-ink">
                {CHARITY_PERCENT}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${CHARITY_PERCENT}%` }}
                transition={{ delay: barDelay + 0.3, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const }}
                className="h-full rounded-full bg-gold"
              />
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: barDelay + 0.9, duration: 0.4 }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-pine/8 px-3 py-1 text-xs text-primary"
          >
            Entered into this month's draw
          </motion.p>
        </div>
      </section>

      {/* How it works — a real sequence, so it earns its numbering */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-md text-2xl font-medium tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rule-t pt-5">
              <span className="tabular text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Charity spotlight */}
      {spotlight && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="max-w-md text-2xl font-medium tracking-tight sm:text-3xl">Where the money goes</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Link
              to={`/charities/${spotlight.id}`}
              className="group grid overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 sm:grid-cols-2"
            >
              <CharityImage charity={spotlight} className="h-56 w-full sm:h-full" />
              <div className="flex flex-col justify-center gap-3 p-8">
                <span className="text-xs text-muted-foreground">Featured charity</span>
                <h3 className="text-2xl font-medium">{spotlight.name}</h3>
                <p className="text-muted-foreground">{spotlight.description}</p>
                <span className="hover-underline mt-2 inline-flex w-fit items-center gap-1 text-sm text-primary">
                  Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
            <div className="grid gap-4">
              {others.map((c) => (
                <CharityCard key={c.id} charity={c} />
              ))}
            </div>
          </div>
          <Link to="/charities" className="hover-underline mt-6 inline-block text-sm text-foreground">
            Browse every charity
          </Link>
        </section>
      )}

      {/* Prize tiers — one ledger, not three identical boxes */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-md text-2xl font-medium tracking-tight sm:text-3xl">
          How the prize pool is shared
        </h2>
        <p className="mt-3 max-w-md text-muted-foreground">
          A fixed part of every subscription funds the pool. Each month we draw five numbers from
          1 to 45 and compare them with your five scores.
        </p>
        <div className="mt-10 overflow-hidden rounded-lg border border-border">
          {TIERS.map((tier) => (
            <div
              key={tier.match}
              className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rule-b px-6 py-5 last:border-b-0 ${
                tier.emphasis ? "bg-gold/8" : ""
              }`}
            >
              <div>
                <p className="font-medium">{tier.match}</p>
                <p className="text-sm text-muted-foreground">{tier.note}</p>
              </div>
              <p className={`tabular font-serif text-3xl italic ${tier.emphasis ? "gold-ink" : "text-primary"}`}>
                {tier.share}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <h2 className="mx-auto max-w-md text-2xl font-medium tracking-tight sm:text-3xl">
            Start with one round and one cause.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Create your account, choose a charity, and you are in next month's draw.
          </p>
          <Magnetic strength={0.2} className="mt-6 inline-block">
            <Button asChild size="lg" className="bg-pine text-primary-foreground hover:bg-pine/90">
              <Link to={ctaTarget}>{user ? "Go to your dashboard" : "Subscribe now"}</Link>
            </Button>
          </Magnetic>
        </div>
      </section>
    </main>
  )
}
