import { Link } from "react-router-dom"

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you asked for does not exist.</p>
      <Link to="/" className="text-sm text-primary underline underline-offset-4">
        Back home
      </Link>
    </main>
  )
}
