// Central business rules. Change numbers here, never inside components.

/** Share of every subscription (monthly-equivalent) that funds the prize pool. */
export const PRIZE_POOL_SHARE = 0.5

/** Pool split per PRD section 07. Shares must add up to 1. */
export const TIER_SHARES = { five: 0.4, four: 0.35, three: 0.25 } as const

/**
 * Only used when a subscription row has no stored amount (for example a test
 * subscription created before amounts were tracked). Major currency units.
 */
export const FALLBACK_MONTHLY_AMOUNT = 10
export const FALLBACK_YEARLY_AMOUNT = 100

/** PRD section 08: minimum 10%. The upper cap keeps prize pool + charity under 100%. */
export const MIN_CHARITY_PERCENT = 10
export const MAX_CHARITY_PERCENT = 50

/** PRD section 05: Stableford 1-45, latest 5 scores kept. */
export const SCORE_MIN = 1
export const SCORE_MAX = 45
export const SCORES_KEPT = 5

/** Display currency. Set VITE_CURRENCY (e.g. INR) if your Stripe prices are not USD. */
export const CURRENCY: string = import.meta.env.VITE_CURRENCY || "USD"
