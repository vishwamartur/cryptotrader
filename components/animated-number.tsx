"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 1,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedNumberProps) {
  const numberRef = useRef<HTMLSpanElement>(null)
  const currentValue = useRef(0)

  useEffect(() => {
    const element = numberRef.current
    if (!element) return

    gsap.to(currentValue, {
      current: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (element) {
          const displayValue = currentValue.current.toFixed(decimals)
          element.textContent = `${prefix}${displayValue}${suffix}`
        }
      },
    })
  }, [value, duration, decimals, prefix, suffix])

  return (
    <span ref={numberRef} className={className}>
      {prefix}0{suffix}
    </span>
  )
}
