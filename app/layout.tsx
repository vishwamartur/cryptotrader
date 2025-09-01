import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ClientBody } from "@/components/client-body"
import { NoSSR } from "@/components/no-ssr"

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Crypto Trading Platform",
  description: "AI-powered crypto trading platform with Delta Exchange integration",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body suppressHydrationWarning={true}>
        <ClientBody>
          {children}
          <NoSSR>
            <Toaster />
          </NoSSR>
          <Analytics />
          <SpeedInsights />
        </ClientBody>
      </body>
    </html>
  )
}
