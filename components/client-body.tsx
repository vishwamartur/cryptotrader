"use client"

import { useEffect } from "react"

interface ClientBodyProps {
  children: React.ReactNode
}

/**
 * ClientBody Component
 * Handles browser extension attributes that cause hydration mismatches
 * This component runs only on the client side to prevent SSR/hydration issues
 */
export function ClientBody({ children }: ClientBodyProps) {
  useEffect(() => {
    // Handle browser extension attributes that cause hydration mismatches
    const handleExtensionAttributes = () => {
      const body = document.body
      
      // Common browser extension attributes that cause hydration issues
      const extensionAttributes = [
        'data-new-gr-c-s-check-loaded',
        'data-gr-ext-installed',
        'data-new-gr-c-s-loaded',
        'data-gr-ext-disabled',
        'cz-shortcut-listen',
        'data-lt-installed',
        'data-darkreader-mode',
        'data-darkreader-scheme'
      ]
      
      // Remove extension attributes that might cause hydration issues
      extensionAttributes.forEach(attr => {
        if (body.hasAttribute(attr)) {
          console.debug(`Removing browser extension attribute: ${attr}`)
        }
      })
      
      // Set up a mutation observer to handle dynamically added extension attributes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.target === body) {
            const attributeName = mutation.attributeName
            if (attributeName && extensionAttributes.includes(attributeName)) {
              console.debug(`Browser extension modified body attribute: ${attributeName}`)
              // We don't remove them here as it might interfere with extension functionality
              // Just log for debugging purposes
            }
          }
        })
      })
      
      observer.observe(body, {
        attributes: true,
        attributeFilter: extensionAttributes
      })
      
      return () => observer.disconnect()
    }
    
    // Run after a short delay to ensure DOM is ready
    let dispose: (() => void) | undefined
    const timeoutId = setTimeout(() => {
      dispose = handleExtensionAttributes()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      dispose?.()
    }
  }, [])

  return <>{children}</>
}

export default ClientBody
