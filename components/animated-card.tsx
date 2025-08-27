"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { Card } from "@/components/ui/card"

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  animation?: "slide" | "fade" | "scale" | "flip"
}

export function AnimatedCard({ children, className = "", delay = 0, animation = "slide" }: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const ctx = gsap.context(() => {
      switch (animation) {
        case "slide":
          gsap.set(card, { opacity: 0, y: 50 })
          break
        case "fade":
          gsap.set(card, { opacity: 0 })
          break
        case "scale":
          gsap.set(card, { opacity: 0, scale: 0.8 })
          break
        case "flip":
          gsap.set(card, { opacity: 0, rotationY: 90 })
          break
      }

      const animation_props: any = { opacity: 1, duration: 0.8, ease: "power3.out", delay }

      switch (animation) {
        case "slide":
          animation_props.y = 0
          break
        case "scale":
          animation_props.scale = 1
          break
        case "flip":
          animation_props.rotationY = 0
          break
      }

      gsap.to(card, animation_props)

      const handleMouseEnter = () => {
        gsap.to(card, {
          scale: 1.02,
          y: -5,
          duration: 0.3,
          ease: "power2.out",
        })
      }

      const handleMouseLeave = () => {
        gsap.to(card, {
          scale: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
        })
      }

      card.addEventListener("mouseenter", handleMouseEnter)
      card.addEventListener("mouseleave", handleMouseLeave)

      return () => {
        card.removeEventListener("mouseenter", handleMouseEnter)
        card.removeEventListener("mouseleave", handleMouseLeave)
      }
    }, cardRef)

    return () => ctx.revert()
  }, [delay, animation])

  return (
    <Card ref={cardRef} className={`transition-all duration-300 ${className}`}>
      {children}
    </Card>
  )
}
