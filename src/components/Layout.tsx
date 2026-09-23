import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import Magnetic from "@/components/motion/Magnetic"

export function Logo() {
  return (
    <span className="text-lg tracking-tight">
      digital.<span className="font-serif text-xl italic text-primary">HEROES</span>.
    </span>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground ${
    isActive ? "text-foreground" : "text-muted-foreground"
  }`

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  // One deliberate, state-driven header behaviour: a hairline appears once
  // the page has actually moved, rather than being there from the start.
  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 8))

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate("/")
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <motion.header
        animate={{
          backgroundColor: scrolled ? "oklch(0.975 0.012 138 / 92%)" : "oklch(0.975 0.012 138 / 0%)",
          borderColor: scrolled ? "var(--hairline)" : "oklch(0.22 0.03 155 / 0%)",
        }}
        transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] as const }}
        className="sticky top-0 z-40 border-b backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
          <Link to="/" aria-label="Digital Heroes home">
            <Logo />
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/charities" className={navClass}>
              Charities
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
            {user ? (
              <Button variant="outline" size="sm" className="ml-2" onClick={handleSignOut}>
                Sign out
              </Button>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <Magnetic className="ml-2 inline-block" strength={0.25}>
                  <Button asChild size="sm" className="bg-gold text-ink hover:bg-gold/90">
                    <Link to="/signup">Subscribe</Link>
                  </Button>
                </Magnetic>
              </>
            )}
          </nav>
        </div>
      </motion.header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="rule-t py-8 text-center text-sm text-muted-foreground">
        <p>A share of every subscription goes to the charity you choose. Prize draws run monthly.</p>
      </footer>
    </div>
  )
}
