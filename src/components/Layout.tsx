import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

export function Logo() {
  return (
    <span className="text-lg font-semibold tracking-tight">
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

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate("/")
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
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
                <Button asChild size="sm" className="ml-2 bg-copper text-background hover:bg-copper/90">
                  <Link to="/signup">Subscribe</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        <p>
          A share of every subscription goes to the charity you choose. Prize draws run monthly.
        </p>
      </footer>
    </div>
  )
}
