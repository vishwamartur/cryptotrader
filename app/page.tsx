'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { UnifiedDashboard } from "@/components/unified-dashboard"

function DashboardWithParams() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') as 'overview' | 'trading' | 'analytics' | 'monitoring' | null

  return <UnifiedDashboard initialView={view} />
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardWithParams />
    </Suspense>
  )
}
