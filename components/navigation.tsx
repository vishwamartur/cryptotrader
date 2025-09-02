"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Home,
  BarChart3,
  TrendingUp,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Activity,
  Zap,
  Shield,
  Brain
} from "lucide-react"

interface NavigationProps {
  theme?: 'light' | 'dark'
  connectionStatus?: 'connected' | 'disconnected' | 'connecting'
}

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
    description: 'Main trading dashboard'
  },
  {
    name: 'Advanced',
    href: '/advanced-dashboard',
    icon: BarChart3,
    description: 'Advanced analytics and monitoring'
  },
  {
    name: 'Multi-API',
    href: '/multi-api-dashboard',
    icon: Activity,
    description: 'Multi-exchange dashboard'
  },
  {
    name: 'DnD Dashboard',
    href: '/advanced-dashboard-dnd',
    icon: Zap,
    description: 'Drag and drop dashboard'
  }
]

const quickActions = [
  {
    name: 'AI Trading',
    icon: Brain,
    action: 'ai-trading',
    color: 'text-blue-500'
  },
  {
    name: 'Risk Monitor',
    icon: Shield,
    action: 'risk-monitor',
    color: 'text-yellow-500'
  },
  {
    name: 'Quick Trade',
    icon: TrendingUp,
    action: 'quick-trade',
    color: 'text-green-500'
  }
]

export function Navigation({ theme = 'dark', connectionStatus = 'connecting' }: NavigationProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleQuickAction = (action: string) => {
    // Handle quick actions
    switch (action) {
      case 'ai-trading':
        // Scroll to AI trading panel or open modal
        const aiPanel = document.querySelector('[data-component="ai-trading-panel"]')
        if (aiPanel) {
          aiPanel.scrollIntoView({ behavior: 'smooth' })
        }
        break
      case 'risk-monitor':
        // Scroll to risk dashboard or open modal
        const riskPanel = document.querySelector('[data-component="risk-dashboard"]')
        if (riskPanel) {
          riskPanel.scrollIntoView({ behavior: 'smooth' })
        }
        break
      case 'quick-trade':
        // Scroll to trading interface or open modal
        const tradingPanel = document.querySelector('[data-component="trading-interface"]')
        if (tradingPanel) {
          tradingPanel.scrollIntoView({ behavior: 'smooth' })
        }
        break
    }
  }

  return (
    <nav className={`border-b backdrop-blur-sm ${
      theme === 'dark' 
        ? 'bg-gray-900/80 border-gray-800' 
        : 'bg-white/80 border-gray-200'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">CryptoTrader</span>
            </Link>
            
            {/* Connection Status */}
            <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'} className="hidden sm:inline-flex">
              <Activity className="w-3 h-3 mr-1" />
              {connectionStatus}
            </Badge>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Quick Actions and User Menu */}
          <div className="flex items-center space-x-2">
            {/* Quick Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Quick Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <DropdownMenuItem
                      key={action.action}
                      onClick={() => handleQuickAction(action.action)}
                      className="cursor-pointer"
                    >
                      <Icon className={`w-4 h-4 mr-2 ${action.color}`} />
                      {action.name}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      <div className="text-left">
                        <div>{item.name}</div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                      </div>
                    </Button>
                  </Link>
                )
              })}
            </div>
            
            {/* Mobile Connection Status */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                <Activity className="w-3 h-3 mr-1" />
                Connection: {connectionStatus}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
