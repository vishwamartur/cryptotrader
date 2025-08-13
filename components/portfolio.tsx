"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, TrendingUp, TrendingDown, RefreshCw, AlertCircle, Settings } from "lucide-react"
import { usePortfolio } from "@/hooks/use-portfolio"
import { useState } from "react"
import { ApiCredentialsDialog } from "@/components/api-credentials-dialog"

export function Portfolio() {
  const [apiCredentials, setApiCredentials] = useState<{ api_key: string; api_secret: string } | null>(null)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)
  const { portfolioData, loading, error } = usePortfolio(apiCredentials)

  if (!apiCredentials) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">API credentials required to view portfolio</p>
              <Button onClick={() => setShowCredentialsDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Setup API Credentials
              </Button>
            </div>
          </CardContent>
        </Card>

        <ApiCredentialsDialog
          open={showCredentialsDialog}
          onOpenChange={setShowCredentialsDialog}
          onSave={setApiCredentials}
          currentCredentials={apiCredentials}
        />
      </>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Portfolio
            <RefreshCw className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 animate-pulse">
            <div className="w-24 h-4 bg-muted rounded mb-2"></div>
            <div className="w-32 h-8 bg-muted rounded mb-2"></div>
            <div className="w-20 h-4 bg-muted rounded"></div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded border animate-pulse">
              <div className="w-16 h-4 bg-muted rounded"></div>
              <div className="w-20 h-4 bg-muted rounded"></div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Portfolio
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCredentialsDialog(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>

        <ApiCredentialsDialog
          open={showCredentialsDialog}
          onOpenChange={setShowCredentialsDialog}
          onSave={setApiCredentials}
          currentCredentials={apiCredentials}
        />
      </>
    )
  }

  const { summary, balances, positions, orders } = portfolioData
  const pnlIsPositive = Number.parseFloat(summary.totalUnrealizedPnL) >= 0

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Portfolio
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Live Data
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setShowCredentialsDialog(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Portfolio Summary */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Balance</span>
              {pnlIsPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold">${summary.totalBalance}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={pnlIsPositive ? "default" : "destructive"}
                className={`text-xs ${
                  pnlIsPositive
                    ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
                    : ""
                }`}
              >
                {pnlIsPositive ? "+" : ""}
                {summary.totalPnLPercent}%
              </Badge>
              <span className={`text-sm ${pnlIsPositive ? "text-green-600" : "text-red-600"}`}>
                {pnlIsPositive ? "+" : ""}${summary.totalUnrealizedPnL}
              </span>
            </div>
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="balances" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="balances">Balances</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
            </TabsList>

            <TabsContent value="balances" className="space-y-3">
              <h4 className="font-semibold text-sm">Asset Balances</h4>
              {balances.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No balances found</p>
              ) : (
                balances
                  .filter((balance) => Number.parseFloat(balance.wallet_balance) > 0)
                  .map((balance) => (
                    <div key={balance.asset_id} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium">{balance.asset_symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          Available: {Number.parseFloat(balance.available_balance).toFixed(6)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{Number.parseFloat(balance.wallet_balance).toFixed(6)}</p>
                        {Number.parseFloat(balance.unrealized_pnl) !== 0 && (
                          <p
                            className={`text-xs ${
                              Number.parseFloat(balance.unrealized_pnl) >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {Number.parseFloat(balance.unrealized_pnl) >= 0 ? "+" : ""}
                            {Number.parseFloat(balance.unrealized_pnl).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </TabsContent>

            <TabsContent value="positions" className="space-y-3">
              <h4 className="font-semibold text-sm">Open Positions</h4>
              {positions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No open positions</p>
              ) : (
                positions.map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="font-medium">{position.product.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Size: {Number.parseFloat(position.size).toFixed(6)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Entry: ${Number.parseFloat(position.entry_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${Number.parseFloat(position.margin).toFixed(2)}</p>
                      <p
                        className={`text-xs ${
                          Number.parseFloat(position.realized_pnl) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {Number.parseFloat(position.realized_pnl) >= 0 ? "+" : ""}
                        {Number.parseFloat(position.realized_pnl).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-3">
              <h4 className="font-semibold text-sm">Recent Orders</h4>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No orders found</p>
              ) : (
                orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="font-medium">{order.product.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.side.toUpperCase()} • {order.order_type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {order.limit_price ? `$${Number.parseFloat(order.limit_price).toFixed(2)}` : "Market"}
                      </p>
                      <p className="text-xs text-muted-foreground">{Number.parseFloat(order.size).toFixed(6)}</p>
                      <Badge
                        variant={
                          order.state === "open" ? "default" : order.state === "closed" ? "secondary" : "outline"
                        }
                        className="text-xs"
                      >
                        {order.state}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ApiCredentialsDialog
        open={showCredentialsDialog}
        onOpenChange={setShowCredentialsDialog}
        onSave={setApiCredentials}
        currentCredentials={apiCredentials}
      />
    </>
  )
}
