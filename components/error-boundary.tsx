"use client"

import React from "react"
import { AlertTriangle, RefreshCw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

/**
 * Enhanced Error Boundary with API Health Integration
 * Provides graceful error handling with retry mechanisms and health diagnostics
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error to our monitoring system
    this.logErrorToMonitoring(error, errorInfo)
  }

  private async logErrorToMonitoring(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Send error to our health monitoring system
      await fetch('/api/health/detailed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'client_error',
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            componentStack: errorInfo.componentStack
          },
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      })
    } catch (monitoringError) {
      console.warn("Failed to log error to monitoring system:", monitoringError)
    }
  }

  private handleRetry = () => {
    const { retryCount } = this.state
    const maxRetries = 3
    
    if (retryCount >= maxRetries) {
      console.warn("Maximum retry attempts reached")
      return
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1
    })

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }

    // Reset retry count after 5 minutes of successful operation
    this.retryTimeoutId = setTimeout(() => {
      this.setState({ retryCount: 0 })
    }, 5 * 60 * 1000)
  }

  private handleCheckHealth = async () => {
    try {
      const response = await fetch('/api/startup?format=summary')
      const data = await response.json()
      
      if (data.canStart) {
        this.handleRetry()
      } else {
        console.warn("System health check failed:", data)
        alert("System health check failed. Please check the console for details.")
      }
    } catch (error) {
      console.error("Health check failed:", error)
      alert("Unable to perform health check. Please try refreshing the page.")
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state
      const maxRetries = 3

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={error!} retry={this.handleRetry} />
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-red-700">Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred in the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Error:</strong> {error?.message || "Unknown error"}
                </AlertDescription>
              </Alert>

              {retryCount > 0 && (
                <Alert>
                  <AlertDescription>
                    Retry attempt: {retryCount} of {maxRetries}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={this.handleRetry}
                  disabled={retryCount >= maxRetries}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {retryCount >= maxRetries ? "Max retries reached" : "Try Again"}
                </Button>

                <Button 
                  variant="outline" 
                  onClick={this.handleCheckHealth}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Check System Health
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && error?.stack && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    Show Error Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook version of ErrorBoundary for functional components
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error("Error caught by useErrorHandler:", error, errorInfo)
    
    // Log to monitoring system
    fetch('/api/health/detailed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'client_error',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }).catch(monitoringError => {
      console.warn("Failed to log error to monitoring system:", monitoringError)
    })
  }
}

export default ErrorBoundary
