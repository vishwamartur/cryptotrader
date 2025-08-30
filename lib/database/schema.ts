import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  decimal, 
  timestamp, 
  boolean, 
  integer,
  jsonb,
  uuid,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  preferences: jsonb('preferences').default({}),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

// Portfolios table
export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  totalValue: decimal('total_value', { precision: 20, scale: 8 }).default('0'),
  totalPnL: decimal('total_pnl', { precision: 20, scale: 8 }).default('0'),
  dailyPnL: decimal('daily_pnl', { precision: 20, scale: 8 }).default('0'),
  balance: decimal('balance', { precision: 20, scale: 8 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('portfolios_user_id_idx').on(table.userId),
}));

// Positions table
export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  side: varchar('side', { length: 10 }).notNull(), // 'long' or 'short'
  size: decimal('size', { precision: 20, scale: 8 }).notNull(),
  entryPrice: decimal('entry_price', { precision: 20, scale: 8 }).notNull(),
  currentPrice: decimal('current_price', { precision: 20, scale: 8 }).notNull(),
  unrealizedPnL: decimal('unrealized_pnl', { precision: 20, scale: 8 }).default('0'),
  unrealizedPnLPercent: decimal('unrealized_pnl_percent', { precision: 10, scale: 4 }).default('0'),
  stopLoss: decimal('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: decimal('take_profit', { precision: 20, scale: 8 }),
  isActive: boolean('is_active').default(true),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  portfolioIdIdx: index('positions_portfolio_id_idx').on(table.portfolioId),
  symbolIdx: index('positions_symbol_idx').on(table.symbol),
  activeIdx: index('positions_active_idx').on(table.isActive),
}));

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  side: varchar('side', { length: 10 }).notNull(), // 'buy' or 'sell'
  type: varchar('type', { length: 20 }).notNull(), // 'market', 'limit', 'stop'
  size: decimal('size', { precision: 20, scale: 8 }).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }),
  filledSize: decimal('filled_size', { precision: 20, scale: 8 }).default('0'),
  filledPrice: decimal('filled_price', { precision: 20, scale: 8 }),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'filled', 'cancelled', 'rejected'
  timeInForce: varchar('time_in_force', { length: 10 }).default('GTC'), // 'GTC', 'IOC', 'FOK'
  externalOrderId: varchar('external_order_id', { length: 100 }),
  fees: decimal('fees', { precision: 20, scale: 8 }).default('0'),
  latency: integer('latency'), // in milliseconds
  createdAt: timestamp('created_at').defaultNow(),
  filledAt: timestamp('filled_at'),
  cancelledAt: timestamp('cancelled_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  portfolioIdIdx: index('orders_portfolio_id_idx').on(table.portfolioId),
  symbolIdx: index('orders_symbol_idx').on(table.symbol),
  statusIdx: index('orders_status_idx').on(table.status),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}));

// Market data table
export const marketData = pgTable('market_data', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }).notNull(),
  volume: decimal('volume', { precision: 20, scale: 8 }).notNull(),
  change: decimal('change', { precision: 20, scale: 8 }).default('0'),
  changePercent: decimal('change_percent', { precision: 10, scale: 4 }).default('0'),
  high24h: decimal('high_24h', { precision: 20, scale: 8 }),
  low24h: decimal('low_24h', { precision: 20, scale: 8 }),
  bid: decimal('bid', { precision: 20, scale: 8 }),
  ask: decimal('ask', { precision: 20, scale: 8 }),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolIdx: index('market_data_symbol_idx').on(table.symbol),
  timestampIdx: index('market_data_timestamp_idx').on(table.timestamp),
  symbolTimestampIdx: index('market_data_symbol_timestamp_idx').on(table.symbol, table.timestamp),
}));

// AI signals table
export const aiSignals = pgTable('ai_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  signal: varchar('signal', { length: 10 }).notNull(), // 'BUY', 'SELL', 'HOLD'
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(),
  reasoning: text('reasoning').notNull(),
  entryPrice: decimal('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: decimal('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: decimal('take_profit', { precision: 20, scale: 8 }),
  riskReward: decimal('risk_reward', { precision: 10, scale: 4 }),
  isExecuted: boolean('is_executed').default(false),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  userIdIdx: index('ai_signals_user_id_idx').on(table.userId),
  symbolIdx: index('ai_signals_symbol_idx').on(table.symbol),
  createdAtIdx: index('ai_signals_created_at_idx').on(table.createdAt),
  signalIdx: index('ai_signals_signal_idx').on(table.signal),
}));

// Trading strategies table
export const tradingStrategies = pgTable('trading_strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  strategyType: varchar('strategy_type', { length: 50 }).notNull(),
  parameters: jsonb('parameters').notNull(),
  isActive: boolean('is_active').default(true),
  totalTrades: integer('total_trades').default(0),
  winningTrades: integer('winning_trades').default(0),
  totalPnL: decimal('total_pnl', { precision: 20, scale: 8 }).default('0'),
  maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 4 }).default('0'),
  sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastExecutedAt: timestamp('last_executed_at'),
}, (table) => ({
  userIdIdx: index('trading_strategies_user_id_idx').on(table.userId),
  strategyTypeIdx: index('trading_strategies_type_idx').on(table.strategyType),
  activeIdx: index('trading_strategies_active_idx').on(table.isActive),
}));

// System health logs table
export const systemHealthLogs = pgTable('system_health_logs', {
  id: serial('id').primaryKey(),
  apiStatus: varchar('api_status', { length: 20 }).notNull(),
  websocketStatus: varchar('websocket_status', { length: 20 }).notNull(),
  latency: integer('latency').notNull(),
  errorRate: decimal('error_rate', { precision: 5, scale: 4 }).default('0'),
  uptime: integer('uptime').default(0),
  memoryUsage: integer('memory_usage'),
  cpuUsage: decimal('cpu_usage', { precision: 5, scale: 2 }),
  activeConnections: integer('active_connections').default(0),
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  timestampIdx: index('system_health_logs_timestamp_idx').on(table.timestamp),
}));

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  portfolios: many(portfolios),
  aiSignals: many(aiSignals),
  tradingStrategies: many(tradingStrategies),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
  positions: many(positions),
  orders: many(orders),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [positions.portfolioId],
    references: [portfolios.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [orders.portfolioId],
    references: [portfolios.id],
  }),
}));

export const aiSignalsRelations = relations(aiSignals, ({ one }) => ({
  user: one(users, {
    fields: [aiSignals.userId],
    references: [users.id],
  }),
}));

export const tradingStrategiesRelations = relations(tradingStrategies, ({ one }) => ({
  user: one(users, {
    fields: [tradingStrategies.userId],
    references: [users.id],
  }),
}));

// ML Models table
export const mlModels = pgTable('ml_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'lstm', 'ensemble', 'reinforcement', 'sentiment', 'anomaly'
  version: varchar('version', { length: 20 }).notNull(),
  description: text('description'),
  parameters: jsonb('parameters').notNull().$type<Record<string, any>>(),
  architecture: jsonb('architecture').$type<Record<string, any> | null>(), // Model architecture details
  trainingData: jsonb('training_data').$type<Record<string, any> | null>(), // Training data metadata
  performance: jsonb('performance').$type<Record<string, any> | null>(), // Model performance metrics
  status: varchar('status', { length: 20 }).default('training'), // 'training', 'active', 'deprecated', 'failed'
  accuracy: decimal('accuracy', { precision: 5, scale: 4 }),
  precision: decimal('precision', { precision: 5, scale: 4 }),
  recall: decimal('recall', { precision: 5, scale: 4 }),
  f1Score: decimal('f1_score', { precision: 5, scale: 4 }),
  sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),
  maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 4 }),
  modelPath: varchar('model_path', { length: 255 }), // Path to saved model
  lastTrainedAt: timestamp('last_trained_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  nameVersionIdx: uniqueIndex('ml_models_name_version_idx').on(table.name, table.version),
  typeIdx: index('ml_models_type_idx').on(table.type),
  statusIdx: index('ml_models_status_idx').on(table.status),
}));

// ML Predictions table
export const mlPredictions = pgTable('ml_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelId: uuid('model_id').references(() => mlModels.id).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  predictionType: varchar('prediction_type', { length: 50 }).notNull(), // 'price', 'direction', 'volatility', 'sentiment'
  timeframe: varchar('timeframe', { length: 20 }).notNull(), // '1m', '5m', '15m', '1h', '4h', '1d'
  inputData: jsonb('input_data').notNull().$type<Record<string, any>>(), // Input features used for prediction
  prediction: jsonb('prediction').notNull().$type<Record<string, any>>(), // Prediction output
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(),
  actualValue: decimal('actual_value', { precision: 20, scale: 8 }), // Actual outcome for validation
  accuracy: decimal('accuracy', { precision: 5, scale: 4 }), // Prediction accuracy when actual is known
  predictionTime: timestamp('prediction_time').notNull(),
  targetTime: timestamp('target_time').notNull(), // When the prediction is for
  validatedAt: timestamp('validated_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  modelIdIdx: index('ml_predictions_model_id_idx').on(table.modelId),
  symbolIdx: index('ml_predictions_symbol_idx').on(table.symbol),
  predictionTimeIdx: index('ml_predictions_prediction_time_idx').on(table.predictionTime),
  targetTimeIdx: index('ml_predictions_target_time_idx').on(table.targetTime),
}));

// ML Features table
export const mlFeatures = pgTable('ml_features', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  features: jsonb('features').notNull(), // All computed features
  technicalIndicators: jsonb('technical_indicators'), // RSI, MACD, Bollinger Bands, etc.
  marketMicrostructure: jsonb('market_microstructure'), // Order book, spread, volume profile
  sentimentData: jsonb('sentiment_data'), // Social media, news sentiment
  macroeconomic: jsonb('macroeconomic'), // Economic indicators
  volatilityMetrics: jsonb('volatility_metrics'), // Various volatility measures
  correlationData: jsonb('correlation_data'), // Cross-asset correlations
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolTimestampIdx: uniqueIndex('ml_features_symbol_timestamp_idx').on(table.symbol, table.timestamp),
  timestampIdx: index('ml_features_timestamp_idx').on(table.timestamp),
}));

// ML Training Jobs table
export const mlTrainingJobs = pgTable('ml_training_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelId: uuid('model_id').references(() => mlModels.id).notNull(),
  jobType: varchar('job_type', { length: 50 }).notNull(), // 'initial', 'retrain', 'hyperparameter_tuning'
  status: varchar('status', { length: 20 }).default('queued'), // 'queued', 'running', 'completed', 'failed'
  parameters: jsonb('parameters').notNull(),
  trainingData: jsonb('training_data'), // Training data configuration
  validationData: jsonb('validation_data'), // Validation data configuration
  results: jsonb('results'), // Training results and metrics
  logs: text('logs'), // Training logs
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  modelIdIdx: index('ml_training_jobs_model_id_idx').on(table.modelId),
  statusIdx: index('ml_training_jobs_status_idx').on(table.status),
  createdAtIdx: index('ml_training_jobs_created_at_idx').on(table.createdAt),
}));

// ML Strategy Performance table
export const mlStrategyPerformance = pgTable('ml_strategy_performance', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').references(() => tradingStrategies.id).notNull(),
  modelId: uuid('model_id').references(() => mlModels.id).notNull(),
  portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
  timeframe: varchar('timeframe', { length: 20 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  totalTrades: integer('total_trades').default(0),
  winningTrades: integer('winning_trades').default(0),
  losingTrades: integer('losing_trades').default(0),
  totalReturn: decimal('total_return', { precision: 20, scale: 8 }).default('0'),
  sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),
  sortinoRatio: decimal('sortino_ratio', { precision: 10, scale: 4 }),
  maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 4 }),
  volatility: decimal('volatility', { precision: 10, scale: 4 }),
  beta: decimal('beta', { precision: 10, scale: 4 }),
  alpha: decimal('alpha', { precision: 10, scale: 4 }),
  informationRatio: decimal('information_ratio', { precision: 10, scale: 4 }),
  calmarRatio: decimal('calmar_ratio', { precision: 10, scale: 4 }),
  winRate: decimal('win_rate', { precision: 5, scale: 4 }),
  avgWin: decimal('avg_win', { precision: 20, scale: 8 }),
  avgLoss: decimal('avg_loss', { precision: 20, scale: 8 }),
  profitFactor: decimal('profit_factor', { precision: 10, scale: 4 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  strategyModelIdx: index('ml_strategy_performance_strategy_model_idx').on(table.strategyId, table.modelId),
  portfolioIdx: index('ml_strategy_performance_portfolio_idx').on(table.portfolioId),
  timeframeIdx: index('ml_strategy_performance_timeframe_idx').on(table.timeframe),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type MarketData = typeof marketData.$inferSelect;
export type NewMarketData = typeof marketData.$inferInsert;
export type AISignal = typeof aiSignals.$inferSelect;
export type NewAISignal = typeof aiSignals.$inferInsert;
export type TradingStrategy = typeof tradingStrategies.$inferSelect;
export type NewTradingStrategy = typeof tradingStrategies.$inferInsert;
export type SystemHealthLog = typeof systemHealthLogs.$inferSelect;
export type NewSystemHealthLog = typeof systemHealthLogs.$inferInsert;
export type MLModel = typeof mlModels.$inferSelect;
export type NewMLModel = typeof mlModels.$inferInsert;
export type MLPrediction = typeof mlPredictions.$inferSelect;
export type NewMLPrediction = typeof mlPredictions.$inferInsert;
export type MLFeature = typeof mlFeatures.$inferSelect;
export type NewMLFeature = typeof mlFeatures.$inferInsert;
export type MLTrainingJob = typeof mlTrainingJobs.$inferSelect;
export type NewMLTrainingJob = typeof mlTrainingJobs.$inferInsert;
export type MLStrategyPerformance = typeof mlStrategyPerformance.$inferSelect;
export type NewMLStrategyPerformance = typeof mlStrategyPerformance.$inferInsert;
