"use client"

import { useState, useCallback } from "react"
import { AITradingEngine, type AITradingConfig, type MarketAnalysis } from "@/lib/ai-trading-engine"
import { useToast } from "@/hooks/use-toast"

export function useAITrading() {
  const [engine, setEngine] = useState<AITradingEngine | null>(null)
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [config, setConfig] = useState<AITradingConfig | null>(null)
  const { toast } = useToast()

  const initializeEngine = useCallback(
    (aiConfig: AITradingConfig) => {
      const aiEngine = new AITradingEngine(aiConfig)
      setEngine(aiEngine)
      setConfig(aiConfig)
      setIsConfigured(true)

      toast({
        title: "AI Trading Engine Initialized",
        description: "Ready for autonomous market analysis",
      })
    },
    [toast],
  )

  const analyzeMarket = useCallback(
    async (marketData: any[], positions: any[], balance: number) => {
      if (!engine) {
        toast({
          title: "AI Engine Not Configured",
          description: "Please configure the AI trading engine first",
          variant: "destructive",
        })
        return
      }

      setIsAnalyzing(true)
      try {
        const result = await engine.analyzeMarket(marketData, positions, balance)
        setAnalysis(result)

        toast({
          title: "Market Analysis Complete",
          description: `Signal: ${result.signal} (${result.confidence}% confidence)`,
        })

        if (config?.enableAutonomousTrading && result.confidence >= 70) {
          const executed = await engine.executeAutonomousTrade(result)
          if (executed) {
            toast({
              title: "Autonomous Trade Executed",
              description: `${result.signal} order placed based on AI analysis`,
            })
          }
        }
      } catch (error) {
        console.error("AI analysis failed:", error)
        toast({
          title: "Analysis Failed",
          description: "Failed to analyze market conditions",
          variant: "destructive",
        })
      } finally {
        setIsAnalyzing(false)
      }
    },
    [engine, config, toast],
  )

  const updateConfig = useCallback(
    (newConfig: Partial<AITradingConfig>) => {
      if (engine) {
        engine.updateConfig(newConfig)
        setConfig((prev) => (prev ? { ...prev, ...newConfig } : null))
      }
    },
    [engine],
  )

  return {
    engine,
    analysis,
    isAnalyzing,
    isConfigured,
    config,
    initializeEngine,
    analyzeMarket,
    updateConfig,
  }
}
