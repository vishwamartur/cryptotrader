"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Eye, EyeOff, ExternalLink, Info, AlertTriangle } from "lucide-react"

interface ApiCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (credentials: { api_key: string; api_secret: string }) => void
  currentCredentials: { api_key: string; api_secret: string } | null
}

export function ApiCredentialsDialog({ open, onOpenChange, onSave, currentCredentials }: ApiCredentialsDialogProps) {
  const [apiKey, setApiKey] = useState(currentCredentials?.api_key || "")
  const [apiSecret, setApiSecret] = useState(currentCredentials?.api_secret || "")
  const [showSecret, setShowSecret] = useState(false)

  const handleSave = () => {
    if (apiKey.trim() && apiSecret.trim()) {
      onSave({ api_key: apiKey.trim(), api_secret: apiSecret.trim() })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delta Exchange API Credentials</DialogTitle>
          <DialogDescription>
            Enter your Delta Exchange API credentials to enable trading functionality.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">How to get your API credentials:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Log in to your Delta Exchange account</li>
                <li>Go to Account Settings → API Management</li>
                <li>Create a new API key with "Trading" permissions</li>
                <li>Copy the API Key and Secret below</li>
              </ol>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-2 text-blue-600 dark:text-blue-400"
                onClick={() => window.open("https://www.delta.exchange/app/account/api", "_blank")}
              >
                Open Delta Exchange API Settings
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-medium mb-1">Common Issues:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>
                  Make sure you're using <strong>production</strong> API keys (not testnet)
                </li>
                <li>Verify your API key has "Trading" permissions enabled</li>
                <li>Check that your API key hasn't expired</li>
                <li>Ensure you're copying the complete key without extra spaces</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">Security Notice:</p>
              <p>Your API credentials are stored locally and never sent to our servers except for trading requests.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="text"
              placeholder="Enter your Delta Exchange API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <div className="relative">
              <Input
                id="api-secret"
                type={showSecret ? "text" : "password"}
                placeholder="Enter your Delta Exchange API secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>• API Key must have "Trading" permissions enabled</p>
            <p>• Use production API keys (not testnet) for live trading</p>
            <p>• Both fields are required and must be valid Delta Exchange credentials</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!apiKey.trim() || !apiSecret.trim()}>
            Save Credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
