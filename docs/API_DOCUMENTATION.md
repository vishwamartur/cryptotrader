# API Documentation

## Overview

This document provides comprehensive API documentation for the CryptoTrader platform, including all available endpoints, request/response formats, and usage examples.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Core Trading APIs

### 1. AI Trading Engine

#### Analyze Market
Performs AI-powered market analysis using Claude 3.5 Sonnet.

**Endpoint**: `POST /api/ai/analyze`

**Request Body**:
```json
{
  "marketData": [
    {
      "symbol": "BTC-USD",
      "price": 45000,
      "volume": 1000000,
      "timestamp": 1693228800000
    }
  ],
  "positions": [
    {
      "id": "1",
      "product": {
        "symbol": "BTC-USD",
        "description": "Bitcoin"
      },
      "size": "0.5",
      "entry_price": "44000",
      "mark_price": "45000",
      "realized_pnl": "0",
      "unrealized_pnl": "500"
    }
  ],
  "balance": 10000
}
```

**Response**:
```json
{
  "signal": "BUY",
  "confidence": 0.85,
  "reasoning": "Strong bullish momentum with increasing volume...",
  "positionSize": 1000,
  "entryPrice": 45000,
  "stopLoss": 44000,
  "takeProfit": 46000,
  "riskReward": 1.0,
  "timestamp": 1693228800000
}
```

### 2. Risk Management

#### Calculate Risk Metrics
Calculates comprehensive risk metrics for the portfolio.

**Endpoint**: `POST /api/risk/metrics`

**Request Body**:
```json
{
  "positions": [
    {
      "id": "1",
      "product": { "symbol": "BTC-USD" },
      "size": "0.5",
      "entry_price": "44000",
      "mark_price": "45000"
    }
  ],
  "balance": 10000
}
```

**Response**:
```json
{
  "totalExposure": 22500,
  "portfolioRisk": 0.15,
  "currentDrawdown": 0.05,
  "valueAtRisk": 1500,
  "sharpeRatio": 1.2,
  "maxDrawdown": 0.08,
  "riskMetrics": {
    "volatility": 0.25,
    "beta": 1.1,
    "correlation": 0.8
  }
}
```

#### Validate Trade
Checks if a trade should be allowed based on risk parameters.

**Endpoint**: `POST /api/risk/validate-trade`

**Request Body**:
```json
{
  "signal": "BUY",
  "symbol": "BTC-USD",
  "positionSize": 1000,
  "positions": [],
  "balance": 10000
}
```

**Response**:
```json
{
  "allowed": true,
  "reason": "Trade within risk limits",
  "adjustedSize": 1000,
  "riskScore": 0.3
}
```

### 3. Quantitative Strategies

#### Execute Strategy
Runs a specific quantitative trading strategy.

**Endpoint**: `POST /api/strategies/execute`

**Request Body**:
```json
{
  "strategy": "MovingAverageCrossover",
  "data": {
    "prices": [44000, 44500, 45000, 45200, 45100]
  },
  "parameters": {
    "shortPeriod": 5,
    "longPeriod": 20
  }
}
```

**Response**:
```json
{
  "action": "BUY",
  "confidence": 0.75,
  "signal": {
    "price": 45100,
    "timestamp": 1693228800000,
    "indicators": {
      "shortMA": 44960,
      "longMA": 44800
    }
  }
}
```

#### List Available Strategies
Returns all available trading strategies.

**Endpoint**: `GET /api/strategies/list`

**Response**:
```json
{
  "strategies": [
    {
      "name": "MovingAverageCrossover",
      "description": "Simple moving average crossover strategy",
      "parameters": ["shortPeriod", "longPeriod"]
    },
    {
      "name": "MeanReversion",
      "description": "Mean reversion trading strategy",
      "parameters": ["lookbackPeriod", "threshold"]
    }
  ]
}
```

### 4. Backtesting

#### Run Backtest
Executes a backtest for a specific strategy.

**Endpoint**: `POST /api/backtest/run`

**Request Body**:
```json
{
  "strategy": "MovingAverageCrossover",
  "data": [
    {
      "symbol": "BTC-USD",
      "price": 45000,
      "volume": 1000000,
      "timestamp": 1693228800000
    }
  ],
  "parameters": {
    "transactionCost": 0.001,
    "slippage": 0.0005,
    "initialCapital": 10000
  }
}
```

**Response**:
```json
{
  "totalReturn": 15.5,
  "sharpeRatio": 1.8,
  "maxDrawdown": 8.2,
  "totalTrades": 45,
  "winRate": 0.67,
  "portfolioValues": [10000, 10150, 10300, 10450],
  "returns": [0.015, 0.0147, 0.0146],
  "trades": [
    {
      "timestamp": 1693228800000,
      "action": "BUY",
      "price": 45000,
      "quantity": 0.2,
      "pnl": 150
    }
  ]
}
```

### 5. Machine Learning

#### Train Model
Trains a machine learning model with provided data.

**Endpoint**: `POST /api/ml/train`

**Request Body**:
```json
{
  "modelType": "LinearRegression",
  "features": [
    [0.5, 0.3, 0.7],
    [0.6, 0.4, 0.8]
  ],
  "targets": [1.2, 1.5],
  "parameters": {
    "learningRate": 0.01,
    "epochs": 100
  }
}
```

**Response**:
```json
{
  "modelId": "model_123",
  "trained": true,
  "accuracy": 0.92,
  "loss": 0.08,
  "epochs": 100
}
```

#### Make Prediction
Makes a prediction using a trained model.

**Endpoint**: `POST /api/ml/predict`

**Request Body**:
```json
{
  "modelId": "model_123",
  "features": [0.5, 0.3, 0.7]
}
```

**Response**:
```json
{
  "prediction": 1.25,
  "confidence": 0.88,
  "modelId": "model_123"
}
```

### 6. Portfolio Management

#### Get Portfolio Status
Returns current portfolio status and metrics.

**Endpoint**: `GET /api/portfolio/status`

**Response**:
```json
{
  "totalValue": 12500,
  "totalPnL": 2500,
  "dailyPnL": 150,
  "positions": [
    {
      "symbol": "BTC-USD",
      "size": 0.5,
      "value": 22500,
      "pnl": 500,
      "percentage": 18.0
    }
  ],
  "allocation": {
    "BTC-USD": 0.18,
    "ETH-USD": 0.12,
    "cash": 0.70
  }
}
```

#### Optimize Portfolio
Runs portfolio optimization using Modern Portfolio Theory.

**Endpoint**: `POST /api/portfolio/optimize`

**Request Body**:
```json
{
  "positions": [],
  "marketData": [],
  "balance": 10000,
  "constraints": {
    "maxPositionWeight": 0.3,
    "minPositionWeight": 0.05,
    "maxRisk": 0.2
  }
}
```

**Response**:
```json
{
  "recommendedAllocations": {
    "BTC-USD": 0.25,
    "ETH-USD": 0.20,
    "cash": 0.55
  },
  "expectedReturn": 0.12,
  "expectedRisk": 0.18,
  "sharpeRatio": 0.67,
  "rebalanceActions": [
    {
      "symbol": "BTC-USD",
      "action": "BUY",
      "amount": 1000
    }
  ]
}
```

### 7. Market Data

#### Get Real-time Data
Retrieves real-time market data for a symbol.

**Endpoint**: `GET /api/market/realtime/:symbol`

**Response**:
```json
{
  "symbol": "BTC-USD",
  "price": 45000,
  "bid": 44995,
  "ask": 45005,
  "volume": 1000000,
  "high24h": 46000,
  "low24h": 44000,
  "change": 500,
  "changePercent": 1.12,
  "timestamp": 1693228800000
}
```

#### Subscribe to WebSocket
WebSocket endpoint for real-time data streaming.

**Endpoint**: `ws://localhost:3000/api/ws/market`

**Subscription Message**:
```json
{
  "action": "subscribe",
  "symbol": "BTC-USD",
  "type": "ticker"
}
```

**Data Message**:
```json
{
  "type": "ticker",
  "symbol": "BTC-USD",
  "price": 45000,
  "volume": 1000000,
  "timestamp": 1693228800000
}
```

## Authentication APIs

### 1. User Registration

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

### 2. User Login

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

### 3. Token Refresh

**Endpoint**: `POST /api/auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response**:
```json
{
  "success": true,
  "token": "new_jwt_token_here"
}
```

## Error Handling

### Error Response Format
```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### Common Error Codes
- `UNAUTHORIZED`: Invalid or missing authentication token
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Authenticated**: 1000 requests per minute per user
- **WebSocket**: 10 connections per user

## SDK Examples

### JavaScript/TypeScript
```typescript
import { CryptoTraderAPI } from '@cryptotrader/sdk';

const api = new CryptoTraderAPI({
  baseURL: 'http://localhost:3000/api',
  apiKey: 'your-api-key'
});

// Analyze market
const analysis = await api.ai.analyzeMarket({
  marketData: [...],
  positions: [...],
  balance: 10000
});

// Run backtest
const backtest = await api.backtest.run({
  strategy: 'MovingAverageCrossover',
  data: [...],
  parameters: {...}
});
```

### Python
```python
from cryptotrader import CryptoTraderAPI

api = CryptoTraderAPI(
    base_url='http://localhost:3000/api',
    api_key='your-api-key'
)

# Analyze market
analysis = api.ai.analyze_market(
    market_data=[...],
    positions=[...],
    balance=10000
)

# Run backtest
backtest = api.backtest.run(
    strategy='MovingAverageCrossover',
    data=[...],
    parameters={...}
)
```

---

**Last Updated**: August 28, 2025  
**API Version**: v1.0  
**Maintained By**: Development Team
