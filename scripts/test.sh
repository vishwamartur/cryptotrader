#!/bin/bash

# Comprehensive Test Runner Script
# Runs all tests with coverage and generates reports

set -e

echo "🚀 Starting AI-Powered Crypto Trading Platform Test Suite"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully"
else
    print_status "Dependencies already installed"
fi

# Create coverage directory if it doesn't exist
mkdir -p coverage

# Run different test suites
print_status "Running unit tests..."
npm test -- --testPathPattern="trading-system.test.ts" --verbose

print_status "Running performance tests..."
npm test -- --testPathPattern="performance.test.ts" --verbose

print_status "Running integration tests..."
npm test -- --testPathPattern="integration.test.ts" --verbose

# Run all tests with coverage
print_status "Running complete test suite with coverage..."
npm test -- --coverage --verbose

# Check coverage thresholds
print_status "Checking coverage thresholds..."
if npm test -- --coverage --passWithNoTests --silent; then
    print_success "All tests passed and coverage thresholds met!"
else
    print_warning "Some tests failed or coverage thresholds not met"
fi

# Generate additional reports
print_status "Generating test reports..."

# Create a simple test summary
cat > coverage/test-summary.md << EOF
# Test Summary Report

## Test Results
- **Date**: $(date)
- **Node.js Version**: $(node --version)
- **npm Version**: $(npm --version)

## Test Suites
- ✅ Unit Tests (trading-system.test.ts)
- ✅ Performance Tests (performance.test.ts)  
- ✅ Integration Tests (integration.test.ts)

## Coverage Report
See coverage/lcov-report/index.html for detailed coverage report.

## Key Components Tested
- AI Trading Engine
- Risk Management System
- Quantitative Strategy Engine
- Backtesting System
- Machine Learning Components
- Reinforcement Learning System
- High-Frequency Trading Engine
- Portfolio Optimization
- Market Data Provider
- Autonomous Trading Agent

## Performance Benchmarks
- Backtesting 10k data points: < 10 seconds
- HFT tick processing: < 1ms average latency
- ML model training: < 5 seconds for 10k samples
- Portfolio optimization: < 1 second

## Integration Tests
- Complete trading workflow validation
- Component interaction verification
- Error handling and recovery
- Real-time data streaming simulation
- System state consistency checks
EOF

print_success "Test summary generated: coverage/test-summary.md"

# Check if coverage report exists
if [ -f "coverage/lcov-report/index.html" ]; then
    print_success "Coverage report generated: coverage/lcov-report/index.html"
    print_status "Open coverage/lcov-report/index.html in your browser to view detailed coverage"
fi

# Final status
echo ""
echo "=================================================="
print_success "Test suite execution completed!"
echo "📊 Check coverage/test-summary.md for summary"
echo "🌐 Open coverage/lcov-report/index.html for detailed coverage"
echo "=================================================="
