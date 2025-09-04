import { NextResponse } from "next/server";
import { getMarketDataForClient } from "@/lib/server-market-data";

export async function GET() {
  try {
    const marketData = await getMarketDataForClient();
    
    // Transform the data into the expected format
    const transformedData = [];
    
    if (marketData.tickers.BTCUSDT) {
      const btc = marketData.tickers.BTCUSDT;
      transformedData.push({
        symbol: 'BTCUSDT',
        price: btc.price || 0,
        change: btc.change_24h || 0,
        changePercent: (btc.change_24h || 0) * 100,
        volume: btc.volume_24h || 0,
        high24h: btc.high_24h || 0,
        low24h: btc.low_24h || 0,
        bid: btc.bid || 0,
        ask: btc.ask || 0,
        bidSize: 1.5,
        askSize: 2.1,
        timestamp: Date.now()
      });
    }
    
    if (marketData.tickers.ETHUSDT) {
      const eth = marketData.tickers.ETHUSDT;
      transformedData.push({
        symbol: 'ETHUSDT',
        price: eth.price || 0,
        change: eth.change_24h || 0,
        changePercent: (eth.change_24h || 0) * 100,
        volume: eth.volume_24h || 0,
        high24h: eth.high_24h || 0,
        low24h: eth.low_24h || 0,
        bid: eth.bid || 0,
        ask: eth.ask || 0,
        bidSize: 5.2,
        askSize: 3.8,
        timestamp: Date.now()
      });
    }

    return NextResponse.json({
      success: true,
      marketData: transformedData,
      timestamp: marketData.timestamp
    });

  } catch (error) {
    console.error('[API] Failed to fetch market data:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch market data',
      marketData: []
    }, { status: 500 });
  }
}
