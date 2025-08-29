# 🗄️ PostgreSQL Database Integration Guide

## 📋 Overview

The CryptoTrader platform now includes comprehensive PostgreSQL database integration using Drizzle ORM for type-safe database operations, connection pooling, and automated migrations.

## 🎯 Database Features

### **Core Functionality**
- **Type-Safe ORM** - Drizzle ORM with full TypeScript support
- **Connection Pooling** - Optimized PostgreSQL connection management
- **Automated Migrations** - Schema versioning and deployment
- **Data Seeding** - Sample data for development and testing
- **Service Layer** - Clean separation of database operations

### **Database Schema**
- **Users** - User accounts with authentication and preferences
- **Portfolios** - Trading portfolios with performance tracking
- **Positions** - Active and historical trading positions
- **Orders** - Order execution tracking with latency metrics
- **Market Data** - Historical price and volume data
- **AI Signals** - Claude 3.5 Sonnet trading recommendations
- **Trading Strategies** - Strategy performance and parameters
- **System Health** - Application monitoring and health logs

## 🚀 Quick Setup

### **Prerequisites**
- PostgreSQL 14+ installed and running
- Node.js 20.x LTS
- npm 9.x or higher

### **1. PostgreSQL Installation**

#### **Windows (using PostgreSQL installer)**
```bash
# Download from https://www.postgresql.org/download/windows/
# Install with default settings
# Remember the password for 'postgres' user
```

#### **macOS (using Homebrew)**
```bash
brew install postgresql@14
brew services start postgresql@14
createdb cryptotrader
```

#### **Linux (Ubuntu/Debian)**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb cryptotrader
```

### **2. Database Configuration**

#### **Create Database and User**
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE cryptotrader;

-- Create user (optional, for production)
CREATE USER cryptotrader_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE cryptotrader TO cryptotrader_user;

-- Exit psql
\q
```

#### **Update Environment Variables**
```env
# Add to .env.local
DATABASE_URL=postgresql://postgres:password@localhost:5432/cryptotrader

# Or with custom user
DATABASE_URL=postgresql://cryptotrader_user:your_secure_password@localhost:5432/cryptotrader

# Optional: Database pool configuration
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=20000
DB_POOL_CONNECT_TIMEOUT=10000
DB_LOGGING=true
```

### **3. Database Setup Commands**

#### **Generate Migrations**
```bash
# Generate migration files from schema
npm run db:generate
```

#### **Run Migrations**
```bash
# Apply migrations to database
npm run db:migrate
```

#### **Seed Database**
```bash
# Add sample data for development
npm run db:seed
```

#### **Complete Setup**
```bash
# Run migrations and seeding in one command
npm run db:setup
```

## 📊 Database Schema Details

### **Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  role VARCHAR(50) DEFAULT 'user',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);
```

### **Portfolios Table**
```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  total_value DECIMAL(20,8) DEFAULT 0,
  total_pnl DECIMAL(20,8) DEFAULT 0,
  daily_pnl DECIMAL(20,8) DEFAULT 0,
  balance DECIMAL(20,8) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Positions Table**
```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'long' or 'short'
  size DECIMAL(20,8) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  current_price DECIMAL(20,8) NOT NULL,
  unrealized_pnl DECIMAL(20,8) DEFAULT 0,
  unrealized_pnl_percent DECIMAL(10,4) DEFAULT 0,
  stop_loss DECIMAL(20,8),
  take_profit DECIMAL(20,8),
  is_active BOOLEAN DEFAULT true,
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🛠️ Service Layer Usage

### **User Service Example**
```typescript
import { UserService } from '@/lib/database/services/user-service';

// Create user
const user = await UserService.createUser({
  email: 'trader@example.com',
  username: 'trader123',
  passwordHash: 'hashed_password',
  firstName: 'John',
  lastName: 'Doe',
});

// Get user with portfolios
const userWithPortfolios = await UserService.getUserWithPortfolios(user.id);
```

### **Portfolio Service Example**
```typescript
import { PortfolioService } from '@/lib/database/services/portfolio-service';

// Get portfolio with positions
const portfolio = await PortfolioService.getPortfolioWithPositions(portfolioId);

// Update portfolio metrics
await PortfolioService.updatePortfolioMetrics(portfolioId);

// Get portfolio performance
const performance = await PortfolioService.getPortfolioPerformance(portfolioId, 30);
```

### **Position Service Example**
```typescript
import { PositionService } from '@/lib/database/services/position-service';

// Create position
const position = await PositionService.createPosition({
  portfolioId: 'portfolio-uuid',
  symbol: 'BTC-USD',
  side: 'long',
  size: '0.5',
  entryPrice: '45000',
  currentPrice: '45000',
});

// Update position price
await PositionService.updatePositionPrice(position.id, 47000);

// Close position
await PositionService.closePosition(position.id, 46500);
```

## 🔧 API Integration

### **Database Health Check**
```bash
GET /api/database/health
```

### **Database-Integrated Portfolio API**
```bash
# Get portfolio from database
GET /api/portfolio/db?userId=user-uuid

# Create new portfolio
POST /api/portfolio/db
{
  "userId": "user-uuid",
  "name": "My Portfolio",
  "description": "Trading portfolio",
  "initialBalance": 10000
}
```

### **Migration and Seeding APIs**
```bash
# Run migrations (development only)
POST /api/database/migrate

# Seed database (development only)
POST /api/database/seed
```

## 🧪 Development Workflow

### **1. Schema Changes**
```bash
# 1. Modify schema in lib/database/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Review generated migration in lib/database/migrations/
# 4. Apply migration
npm run db:migrate
```

### **2. Testing with Database**
```bash
# Start with fresh database
npm run db:setup

# Run tests
npm test

# Check database in browser
npm run db:studio
```

### **3. Data Management**
```bash
# Reset database (development)
npm run db:drop
npm run db:setup

# Backup database
pg_dump cryptotrader > backup.sql

# Restore database
psql cryptotrader < backup.sql
```

## 📈 Performance Optimization

### **Connection Pooling**
- **Min Connections**: 2 (configurable)
- **Max Connections**: 20 (configurable)
- **Idle Timeout**: 20 seconds
- **Connect Timeout**: 10 seconds

### **Indexing Strategy**
- **Primary Keys**: UUID with btree index
- **Foreign Keys**: Indexed for join performance
- **Query Columns**: Indexed on frequently queried columns
- **Composite Indexes**: For complex queries

### **Query Optimization**
- **Prepared Statements**: Disabled for better compatibility
- **Connection Reuse**: Efficient connection pooling
- **Batch Operations**: Bulk inserts and updates
- **Selective Queries**: Only fetch required columns

## 🔒 Security Considerations

### **Authentication**
- **Password Hashing**: bcrypt with salt rounds 12
- **SQL Injection**: Parameterized queries via Drizzle ORM
- **Connection Security**: SSL/TLS for production connections

### **Data Protection**
- **Sensitive Data**: Encrypted at rest (database level)
- **Access Control**: Role-based permissions
- **Audit Logging**: Track data modifications

## 🚀 Production Deployment

### **Environment Setup**
```env
# Production database URL
DATABASE_URL=postgresql://user:password@prod-host:5432/cryptotrader?sslmode=require

# Connection pool for production
DB_POOL_MIN=5
DB_POOL_MAX=50
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECT_TIMEOUT=15000
DB_LOGGING=false
```

### **Migration Strategy**
```bash
# 1. Backup production database
pg_dump production_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migrations on staging
npm run db:migrate

# 3. Deploy to production
npm run db:migrate
```

### **Monitoring**
- **Connection Pool**: Monitor active/idle connections
- **Query Performance**: Track slow queries
- **Database Size**: Monitor storage usage
- **Health Checks**: Regular connectivity tests

## 📞 Troubleshooting

### **Common Issues**

#### **Connection Failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection string
psql "postgresql://postgres:password@localhost:5432/cryptotrader"
```

#### **Migration Errors**
```bash
# Check migration status
npm run db:studio

# Reset migrations (development only)
npm run db:drop
npm run db:setup
```

#### **Permission Errors**
```sql
-- Grant permissions to user
GRANT ALL PRIVILEGES ON DATABASE cryptotrader TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### **Performance Issues**
- **Check Indexes**: Ensure proper indexing on query columns
- **Connection Pool**: Adjust pool size based on load
- **Query Analysis**: Use EXPLAIN ANALYZE for slow queries

---

**Status**: ✅ **Production Ready**  
**Version**: 1.0.0  
**Last Updated**: August 2025  
**Maintainer**: CryptoTrader Development Team
