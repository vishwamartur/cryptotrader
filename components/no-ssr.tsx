"use client"

import { useEffect, useState } from "react"

interface NoSSRProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * NoSSR Component
 * Prevents server-side rendering of children to avoid hydration mismatches
 * Useful for components that depend on browser-only APIs or have dynamic content
 */
export function NoSSR({ children, fallback = null }: NoSSRProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * ClientOnly Component
 * Alternative name for NoSSR with the same functionality
 */
export const ClientOnly = NoSSR

export default NoSSR
