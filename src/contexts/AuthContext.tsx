import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/lib/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"]

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** The active subscription if there is one, otherwise the most recent row. */
  subscription: Subscription | null
  loading: boolean
  isAdmin: boolean
  isActiveSubscriber: boolean
  signUp: (
    email: string,
    password: string,
    fullName: string,
    charityId?: string
  ) => Promise<{ needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isActiveSubscriber, setIsActiveSubscriber] = useState(false)
  const [loading, setLoading] = useState(true)
  // Which user id we last finished loading, so token refreshes don't flash a spinner.
  const loadedFor = useRef<string | null>(null)

  async function loadProfile(userId: string) {
    const [profileResult, subsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ])
    setProfile(profileResult.data ?? null)

    // Same rule as the database function is_active_subscriber().
    const rows = subsResult.data ?? []
    const active = rows.find(
      (s) =>
        s.status === "active" &&
        (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now())
    )
    setSubscription(active ?? rows[0] ?? null)
    setIsActiveSubscriber(Boolean(active))
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id)
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on start-up, so it is the single
    // source of truth. Supabase calls are deferred with setTimeout because
    // awaiting them inside this callback can deadlock the auth client.
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        const uid = nextSession.user.id
        if (loadedFor.current !== uid) setLoading(true)
        setTimeout(() => {
          loadProfile(uid).finally(() => {
            loadedFor.current = uid
            setLoading(false)
          })
        }, 0)
      } else {
        loadedFor.current = null
        setProfile(null)
        setSubscription(null)
        setIsActiveSubscriber(false)
        setLoading(false)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, fullName: string, charityId?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // The database trigger handle_new_user() copies these into the profile row.
      options: { data: { full_name: fullName, charity_id: charityId ?? "" } },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value: AuthContextValue = {
    user,
    session,
    profile,
    subscription,
    loading,
    isAdmin: profile?.role === "admin",
    isActiveSubscriber,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
