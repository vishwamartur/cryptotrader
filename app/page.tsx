import { MarketOverview } from "@/components/market-overview"
import { Portfolio } from "@/components/portfolio"
import { Header } from "@/components/header"
import { AITradingPanel } from "@/components/ai-trading-panel"
import { RiskDashboard } from "@/components/risk-dashboard"
import { TradeMonitor } from "@/components/trade-monitor"
import { AutonomousAgentPanel } from "@/components/autonomous-agent-panel"
import { TakeProfitPanel } from "@/components/take-profit-panel"
import { PositionManagementPanel } from "@/components/position-management-panel"

export default function TradingDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Market Overview - Full width on mobile, 2 cols on desktop */}
          <div className="lg:col-span-2">
            <MarketOverview />
          </div>

          {/* Portfolio - Right sidebar */}
          <div className="lg:col-span-1">
            <Portfolio />
          </div>

          {/* AI Trading Panel */}
          <div className="lg:col-span-1">
            <AITradingPanel />
          </div>

          {/* Risk Dashboard */}
          <div className="lg:col-span-1">
            <RiskDashboard />
          </div>

          {/* Autonomous Agent Panel */}
          <div className="lg:col-span-1">
            <AutonomousAgentPanel />
          </div>

          {/* Take Profit Panel */}
          <div className="lg:col-span-1">
            <TakeProfitPanel />
          </div>

          {/* Position Management Panel */}
          <div className="lg:col-span-1">
            <PositionManagementPanel />
          </div>

          {/* Trade Monitor - Full width */}
          <div className="lg:col-span-4">
            <TradeMonitor />
          </div>
        </div>
      </main>
    </div>
  )
}
