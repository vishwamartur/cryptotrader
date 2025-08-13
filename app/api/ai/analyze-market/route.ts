import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, config, marketData, positions, balance } = await request.json()

    if (!config.apiKey) {
      return NextResponse.json({ error: "Claude API key is required" }, { status: 400 })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Claude API error:", errorData)
      return NextResponse.json({ error: `Claude API error: ${response.statusText}` }, { status: response.status })
    }

    const claudeResponse = await response.json()
    const content = claudeResponse.content[0].text

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
      console.error("Failed to parse Claude response:", parseError)
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
