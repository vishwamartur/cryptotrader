"use client"

import { useState, useCallback } from "react"
import { AutonomousAgent, type AgentConfig, type AgentState, type AgentDecision } from "@/lib/autonomous-agent"
import { useToast } from "@/hooks/use-toast"

export function useAutonomousAgent() {
  const [agent, setAgent] = useState<AutonomousAgent | null>(null)
  const [state, setState] = useState<AgentState | null>(null)
  const [decisions, setDecisions] = useState<AgentDecision[]>([])
  const [isConfigured, setIsConfigured] = useState(false)
  const { toast } = useToast()

  const initializeAgent = useCallback(
    (config: AgentConfig) => {
      const newAgent = new AutonomousAgent(config)
      setAgent(newAgent)
      setIsConfigured(true)

      // Subscribe to state updates
      const unsubscribe = newAgent.subscribe((newState) => {
        setState(newState)
        setDecisions(newAgent.getDecisions())

        // Show notifications for important state changes
        if (newState.status === "ERROR" && newState.errors.length > 0) {
          toast({
            title: "Agent Error",
            description: newState.errors[newState.errors.length - 1],
            variant: "destructive",
          })
        }
      })

      // Initial state
      setState(newAgent.getState())
      setDecisions(newAgent.getDecisions())

      toast({
        title: "Autonomous Agent Initialized",
        description: "Ready for autonomous trading",
      })

      return unsubscribe
    },
    [toast],
  )

  const startAgent = useCallback(() => {
    if (agent) {
      agent.start()
      toast({
        title: "Agent Started",
        description: "Autonomous trading is now active",
      })
    }
  }, [agent, toast])

  const stopAgent = useCallback(() => {
    if (agent) {
      agent.stop()
      toast({
        title: "Agent Stopped",
        description: "Autonomous trading has been stopped",
      })
    }
  }, [agent, toast])

  const pauseAgent = useCallback(() => {
    if (agent) {
      agent.pause()
      toast({
        title: "Agent Paused",
        description: "Autonomous trading is paused",
      })
    }
  }, [agent, toast])

  const resumeAgent = useCallback(() => {
    if (agent) {
      agent.resume()
      toast({
        title: "Agent Resumed",
        description: "Autonomous trading has resumed",
      })
    }
  }, [agent, toast])

  const updateConfig = useCallback(
    (newConfig: Partial<AgentConfig>) => {
      if (agent) {
        agent.updateConfig(newConfig)
        toast({
          title: "Configuration Updated",
          description: "Agent configuration has been updated",
        })
      }
    },
    [agent, toast],
  )

  const resetDailyCounters = useCallback(() => {
    if (agent) {
      agent.resetDailyCounters()
      toast({
        title: "Daily Counters Reset",
        description: "Daily trading limits have been reset",
      })
    }
  }, [agent, toast])

  return {
    agent,
    state,
    decisions,
    isConfigured,
    initializeAgent,
    startAgent,
    stopAgent,
    pauseAgent,
    resumeAgent,
    updateConfig,
    resetDailyCounters,
  }
}
