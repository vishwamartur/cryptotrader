import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, User, Settings, BarChart3, Move } from "lucide-react"
import Link from "next/link"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">CryptoTrader</h1>
            </div>
            <Badge variant="secondary" className="text-xs">
              Delta Exchange
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="default" size="sm">
              <Link href="/advanced-dashboard">
                <TrendingUp className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/advanced-dashboard-dnd">
                <Move className="h-4 w-4" />
                Drag & Drop
              </Link>
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <User className="h-4 w-4" />
              Account
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
