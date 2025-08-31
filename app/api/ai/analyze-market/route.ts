import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, config, marketData, positions, balance } = await request.json()

    const apiKey = config?.apiKey || process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Perplexity API key is required" }, { status: 400 })
    }

    // add an AbortController to enforce a bounded timeout
    const controller = new AbortController()
    // Robust timeout validation: ensure user input cannot exhaust resources
    const DEFAULT_TIMEOUT_MS = 20_000
    const MIN_TIMEOUT_MS = 1_000
    const MAX_TIMEOUT_MS = 60_000
    let timeoutMs = DEFAULT_TIMEOUT_MS
    if (typeof config?.timeoutMs === "number" && Number.isFinite(config.timeoutMs)) {
      timeoutMs = Math.min(Math.max(config.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
    }
    // Disallow other types/invalid input explicitly
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model || "llama-3.1-sonar-large-128k-online",
        max_tokens: config?.maxTokens ?? 1000,
        temperature: config?.temperature ?? 0.1,
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency trading analyst with access to real-time market data and news. Provide detailed market analysis and trading recommendations. IMPORTANT: Respond ONLY with minified JSON matching this schema: {\"signal\":\"BUY\"|\"SELL\"|\"HOLD\",\"confidence\":number,\"rationale\":string,\"timeframe\":string,\"targets\":number[],\"stops\":number[]}. No markdown or code fences."
          },
          {
            role: "user",
            content: prompt,
          },
          {
            role: "user",
            content: JSON.stringify({ marketData, positions, balance })
          },
        ],
      }),
    })
    clearTimeout(timer)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Perplexity API error:", errorData)
      return NextResponse.json({ error: `Perplexity API error: ${response.statusText}` }, { status: response.status })
    }

    const perplexityResponse = await response.json()
    const content = perplexityResponse.choices?.[0]?.message?.content || ''

    try {
      const analysis = JSON.parse(content)

      const enhancedAnalysis = {
        ...analysis,
        timestamp: new Date().toISOString(),
        marketConditions: {
          volatility: calculateVolatility(marketData),
          trend: determineTrend(marketData),
          volume: calculateAverageVolume(marketData),
        },
      }

      return NextResponse.json(enhancedAnalysis)
    } catch (parseError) {
      console.error("Failed to parse Perplexity response:", parseError)
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 })
    }
  } catch (error) {
    console.error("AI analysis error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function calculateVolatility(marketData: any[]): number {
  if (marketData.length < 2) return 0

  const changes = marketData.map((data) => Math.abs(data.change24h))
  const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length
  return avgChange
}

function determineTrend(marketData: any[]): "bullish" | "bearish" | "neutral" {
  const positiveChanges = marketData.filter((data) => data.change24h > 0).length
  const ratio = positiveChanges / marketData.length

  if (ratio > 0.6) return "bullish"
  if (ratio < 0.4) return "bearish"
  return "neutral"
}

function calculateAverageVolume(marketData: any[]): number {
  const volumes = marketData.map((data) => data.volume || 0)
  return volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length
}
