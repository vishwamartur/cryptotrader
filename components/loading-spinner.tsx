"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"

export function LoadingSpinner() {
  const spinnerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const spinner = spinnerRef.current
    if (!spinner) return

    gsap.to(spinner, {
      rotation: 360,
      duration: 1,
      ease: "none",
      repeat: -1,
    })
  }, [])

  return (
    <div className="flex items-center justify-center p-8">
      <div ref={spinnerRef} className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
}
