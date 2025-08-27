"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { MarketOverview } from "@/components/market-overview"
import { Portfolio } from "@/components/portfolio"
import { Header } from "@/components/header"
import { TradingInterface } from "@/components/trading-interface"

gsap.registerPlugin(ScrollTrigger)

export default function TradingDashboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(".trading-card", { opacity: 0, y: 50, scale: 0.95 })
      gsap.set(".header-element", { opacity: 0, y: -30 })

      // Header animation
      gsap.to(".header-element", {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
      })

      // Cards entrance animation
      gsap.to(".trading-card", {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        stagger: 0.15,
        delay: 0.3,
      })

      gsap.to(".trading-card", {
        y: -5,
        duration: 2,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.3,
        delay: 1.5,
      })

      gsap.to(".pulse-element", {
        scale: 1.05,
        duration: 1.5,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.2,
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div ref={headerRef} className="header-element relative z-10">
        <Header />
      </div>

      <main className="container mx-auto px-4 py-6 relative z-10">
        <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Overview */}
          <div className="lg:col-span-2 trading-card">
            <MarketOverview />
          </div>

          {/* Portfolio */}
          <div className="lg:col-span-1 trading-card pulse-element">
            <Portfolio />
          </div>

          {/* Trading Interface */}
          <div className="lg:col-span-3 trading-card">
            <TradingInterface />
          </div>
        </div>
      </main>
    </div>
  )
}
