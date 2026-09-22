// Hand-written types matching supabase/migrations/*.sql.
// You can replace this file with generated types later:
//   supabase gen types typescript --linked > src/lib/database.types.ts

export type UserRole = "subscriber" | "admin"
export type SubscriptionPlan = "monthly" | "yearly"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "inactive"
export type DrawType = "random" | "algorithmic"
export type DrawStatus = "draft" | "simulated" | "published"
export type MatchTier = "five" | "four" | "three"
export type VerificationStatus = "pending" | "approved" | "rejected"
export type PaymentStatus = "pending" | "paid"
export type ContributionType = "subscription_pledge" | "independent_donation"

/** Shape returned by the admin_report() SQL function. */
export type AdminReport = {
  total_users: number
  active_subscribers: number
  total_prize_pool: number
  total_paid_out: number
  total_pending_payout: number
  charity_total: number
  charity_from_subscriptions: number
  charity_independent: number
  draws_published: number
  winners_total: number
  jackpot_rollovers: number
  by_charity: { name: string; total: number }[]
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: UserRole
          charity_id: string | null
          charity_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
        Relationships: []
      }
      charities: {
        Row: {
          id: string
          name: string
          description: string | null
          image_url: string | null
          website_url: string | null
          is_featured: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["charities"]["Row"]> & { name: string }
        Update: Partial<Database["public"]["Tables"]["charities"]["Row"]>
        Relationships: []
      }
      charity_events: {
        Row: {
          id: string
          charity_id: string
          title: string
          description: string | null
          location: string | null
          event_date: string
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["charity_events"]["Row"]> & {
          charity_id: string
          title: string
          event_date: string
        }
        Update: Partial<Database["public"]["Tables"]["charity_events"]["Row"]>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: SubscriptionPlan
          status: SubscriptionStatus
          amount_cents: number | null
          currency: string
          current_period_start: string | null
          current_period_end: string | null
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
          user_id: string
          plan: SubscriptionPlan
        }
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>
        Relationships: []
      }
      scores: {
        Row: {
          id: string
          user_id: string
          score: number
          score_date: string
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["scores"]["Row"]> & {
          user_id: string
          score: number
          score_date: string
        }
        Update: Partial<Database["public"]["Tables"]["scores"]["Row"]>
        Relationships: []
      }
      draws: {
        Row: {
          id: string
          draw_month: string
          draw_type: DrawType
          status: DrawStatus
          winning_numbers: number[] | null
          total_active_subscribers: number | null
          prize_pool_total: number | null
          five_match_pool: number | null
          four_match_pool: number | null
          three_match_pool: number | null
          five_match_rollover_in: number
          five_match_rollover_out: boolean
          created_by: string | null
          simulated_at: string | null
          published_at: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["draws"]["Row"]> & { draw_month: string }
        Update: Partial<Database["public"]["Tables"]["draws"]["Row"]>
        Relationships: []
      }
      draw_entries: {
        Row: {
          id: string
          draw_id: string
          user_id: string
          numbers: number[]
          match_tier: MatchTier | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["draw_entries"]["Row"]> & {
          draw_id: string
          user_id: string
          numbers: number[]
        }
        Update: Partial<Database["public"]["Tables"]["draw_entries"]["Row"]>
        Relationships: []
      }
      winners: {
        Row: {
          id: string
          draw_id: string
          user_id: string
          draw_entry_id: string | null
          match_tier: MatchTier
          prize_amount: number
          proof_url: string | null
          verification_status: VerificationStatus
          payment_status: PaymentStatus
          verified_by: string | null
          verified_at: string | null
          paid_at: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["winners"]["Row"]> & {
          draw_id: string
          user_id: string
          match_tier: MatchTier
          prize_amount: number
        }
        Update: Partial<Database["public"]["Tables"]["winners"]["Row"]>
        Relationships: []
      }
      donations: {
        Row: {
          id: string
          user_id: string
          charity_id: string
          subscription_id: string | null
          amount: number
          contribution_type: ContributionType
          stripe_ref: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["donations"]["Row"]> & {
          user_id: string
          charity_id: string
          amount: number
        }
        Update: Partial<Database["public"]["Tables"]["donations"]["Row"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      submit_winner_proof: {
        Args: { p_winner_id: string; p_proof_url: string }
        Returns: undefined
      }
      admin_report: {
        Args: Record<string, never>
        Returns: AdminReport
      }
    }
  }
}
