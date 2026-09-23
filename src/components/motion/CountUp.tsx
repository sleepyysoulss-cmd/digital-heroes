import { useEffect, useRef } from "react"
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion"

/**
 * Ticks a number up from 0 once, on mount (a page opening, a result landing)
 * — never on scroll, so it fires exactly once per page rather than replaying
 * as the person scrolls past it.
 */
export default function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 0.9,
  delay = 0,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  delay?: number
  className?: string
}) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(0)

  useMotionValueEvent(motionVal, "change", (latest) => {
    if (spanRef.current) spanRef.current.textContent = format(latest)
  })

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration,
      delay,
      ease: [0.2, 0.7, 0.2, 1] as const,
    })
    return controls.stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span ref={spanRef} className={`tabular ${className ?? ""}`}>
      {format(0)}
    </span>
  )
}
