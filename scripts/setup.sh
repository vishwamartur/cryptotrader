#!/bin/bash

set -e

echo "🔧 Setting up Crypto Trading Platform..."

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Install pnpm if not installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup environment variables
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your API keys"
fi

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
pnpm prepare

# Run initial build
echo "🏗️ Running initial build..."
pnpm build

echo "✅ Setup completed successfully!"
echo "🚀 Run 'pnpm dev' to start development server"
