import { NextRequest, NextResponse } from 'next/server';

// Cache for products data
let productsCache: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Delta Exchange API endpoints
const DELTA_API_BASE = 'https://api.delta.exchange';

interface DeltaProduct {
  id: number;
  symbol: string;
  description: string;
  created_at: string;
  updated_at: string;
  settlement_time: string | null;
  notional_type: string;
  impact_size: number;
  initial_margin: number;
  maintenance_margin: number;
  contract_value: number;
  contract_unit_currency: string;
  tick_size: number;
  product_specs: {
    underlying_asset: {
      id: number;
      symbol: string;
      name: string;
    };
    quoting_asset: {
      id: number;
      symbol: string;
      name: string;
    };
    settling_asset: {
      id: number;
      symbol: string;
      name: string;
    };
  };
  state: string;
  trading_status: string;
  max_leverage_notional: number;
  default_leverage: number;
  initial_margin_scaling_factor: number;
  maintenance_margin_scaling_factor: number;
  taker_commission_rate: number;
  maker_commission_rate: number;
  liquidation_penalty_factor: number;
  contract_type: string;
  position_size_limit: number;
  basis_factor_max_limit: number;
  is_quanto: boolean;
  funding_method: string;
  annualized_funding: number;
  price_band: {
    lower_limit: string;
    upper_limit: string;
  };
  product_type: string;
  launch_time: string | null;
  strike_price?: string;
  expiry_time?: string;
  option_type?: string;
}

interface DeltaProductsResponse {
  success: boolean;
  result: DeltaProduct[];
  meta?: {
    after: string | null;
    before: string | null;
  };
}

async function fetchAllProducts(): Promise<DeltaProduct[]> {
  const allProducts: DeltaProduct[] = [];
  let after: string | null = null;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = new URL(`${DELTA_API_BASE}/v2/products`);
      url.searchParams.set('page_size', '100');
      if (after) {
        url.searchParams.set('after', after);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CryptoTrader/1.0',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      });

      if (!response.ok) {
        throw new Error(`Delta Exchange API error: ${response.status} ${response.statusText}`);
      }

      const data: DeltaProductsResponse = await response.json();

      if (!data.success) {
        throw new Error('Delta Exchange API returned unsuccessful response');
      }

      allProducts.push(...data.result);

      // Check if there are more pages
      after = data.meta?.after || null;
      hasMore = after !== null && data.result.length > 0;

    } catch (error) {
      console.error('Error fetching products from Delta Exchange:', error);
      throw error;
    }
  }

  return allProducts;
}

function transformProductsForClient(products: DeltaProduct[]) {
  return products
    .filter(product =>
      product.state === 'live' &&
      product.trading_status === 'operational' &&
      (product.product_type === 'perpetual_futures' ||
       product.product_type === 'futures' ||
       product.product_type === 'call_options' ||
       product.product_type === 'put_options')
    )
    .map(product => ({
      id: product.id,
      symbol: product.symbol,
      description: product.description,
      productType: product.product_type,
      contractType: product.contract_type,
      underlyingAsset: product.product_specs.underlying_asset.symbol,
      quotingAsset: product.product_specs.quoting_asset.symbol,
      settlingAsset: product.product_specs.settling_asset.symbol,
      tickSize: product.tick_size,
      contractValue: product.contract_value,
      contractUnit: product.contract_unit_currency,
      maxLeverage: product.max_leverage_notional,
      defaultLeverage: product.default_leverage,
      takerFee: product.taker_commission_rate,
      makerFee: product.maker_commission_rate,
      tradingStatus: product.trading_status,
      state: product.state,
      isQuanto: product.is_quanto,
      fundingMethod: product.funding_method,
      annualizedFunding: product.annualized_funding,
      priceBand: product.price_band,
      launchTime: product.launch_time,
      expiryTime: product.expiry_time || null,
      strikePrice: product.strike_price || null,
      optionType: product.option_type || null,
    }))
    .sort((a, b) => {
      // Sort by product type priority, then by symbol
      const typeOrder = {
        'perpetual_futures': 1,
        'futures': 2,
        'call_options': 3,
        'put_options': 4
      };

      const aOrder = typeOrder[a.productType as keyof typeof typeOrder] || 5;
      const bOrder = typeOrder[b.productType as keyof typeof typeOrder] || 5;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return a.symbol.localeCompare(b.symbol);
    });
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();

    // Check cache
    if (productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        result: productsCache,
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000),
      });
    }

    // Fetch fresh data
    const products = await fetchAllProducts();
    const transformedProducts = transformProductsForClient(products);

    // Update cache
    productsCache = transformedProducts;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      result: transformedProducts,
      cached: false,
      totalProducts: transformedProducts.length,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in products API:', error);

    // Return cached data if available, even if stale
    if (productsCache) {
      return NextResponse.json({
        success: true,
        result: productsCache,
        cached: true,
        stale: true,
        error: 'Failed to fetch fresh data, returning cached data',
        cacheAge: Math.floor((Date.now() - cacheTimestamp) / 1000),
      });
    }

    // Return fallback data if no cache available
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch products from Delta Exchange',
      fallback: true,
      result: [
        {
          id: 27,
          symbol: 'BTCUSD',
          description: 'Bitcoin Perpetual',
          productType: 'perpetual_futures',
          underlyingAsset: 'BTC',
          quotingAsset: 'USD',
          settlingAsset: 'USD',
          tradingStatus: 'operational',
          state: 'live'
        },
        {
          id: 139,
          symbol: 'ETHUSD',
          description: 'Ethereum Perpetual',
          productType: 'perpetual_futures',
          underlyingAsset: 'ETH',
          quotingAsset: 'USD',
          settlingAsset: 'USD',
          tradingStatus: 'operational',
          state: 'live'
        }
      ]
    }, { status: 500 });
  }
}
