#!/bin/bash

set -e

echo "🚀 Starting deployment process..."

# Check if required environment variables are set
if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ VERCEL_TOKEN is not set"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Run tests
echo "🧪 Running tests..."
pnpm test

# Run linting
echo "🔍 Running linting..."
pnpm lint:check

# Type checking
echo "📝 Type checking..."
pnpm type-check

# Security audit
echo "🔒 Security audit..."
pnpm audit

# Build application
echo "🏗️ Building application..."
pnpm build

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod --token=$VERCEL_TOKEN

echo "✅ Deployment completed successfully!"
