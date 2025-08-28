# Comprehensive Test Runner Script for Windows PowerShell
# Runs all tests with coverage and generates reports

param(
    [switch]$SkipInstall,
    [switch]$Verbose,
    [string]$TestPattern = "*"
)

Write-Host "🚀 Starting AI-Powered Crypto Trading Platform Test Suite" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Status "npm version: $npmVersion"
} catch {
    Write-Error "npm is not installed. Please install npm first."
    exit 1
}

# Install dependencies if node_modules doesn't exist or if not skipping
if (-not (Test-Path "node_modules") -or -not $SkipInstall) {
    Write-Status "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error "Failed to install dependencies"
        exit 1
    }
} else {
    Write-Status "Skipping dependency installation"
}

# Create coverage directory if it doesn't exist
if (-not (Test-Path "coverage")) {
    New-Item -ItemType Directory -Path "coverage" | Out-Null
}

# Function to run tests with error handling
function Run-TestSuite {
    param(
        [string]$TestName,
        [string]$TestPattern,
        [switch]$Coverage
    )
    
    Write-Status "Running $TestName..."
    
    $testCommand = "npm test"
    if ($TestPattern -ne "*") {
        $testCommand += " -- --testPathPattern=`"$TestPattern`""
    }
    if ($Coverage) {
        $testCommand += " -- --coverage"
    }
    if ($Verbose) {
        $testCommand += " --verbose"
    }
    
    try {
        Invoke-Expression $testCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$TestName completed successfully"
            return $true
        } else {
            Write-Warning "$TestName completed with warnings"
            return $false
        }
    } catch {
        Write-Error "Failed to run $TestName : $_"
        return $false
    }
}

# Track test results
$testResults = @{}

# Run different test suites based on pattern
if ($TestPattern -eq "*" -or $TestPattern -like "*trading-system*") {
    $testResults["Unit Tests"] = Run-TestSuite -TestName "Unit Tests" -TestPattern "trading-system.test.ts"
}

if ($TestPattern -eq "*" -or $TestPattern -like "*performance*") {
    $testResults["Performance Tests"] = Run-TestSuite -TestName "Performance Tests" -TestPattern "performance.test.ts"
}

if ($TestPattern -eq "*" -or $TestPattern -like "*integration*") {
    $testResults["Integration Tests"] = Run-TestSuite -TestName "Integration Tests" -TestPattern "integration.test.ts"
}

# Run complete test suite with coverage if no specific pattern
if ($TestPattern -eq "*") {
    Write-Status "Running complete test suite with coverage..."
    $testResults["Coverage Tests"] = Run-TestSuite -TestName "Coverage Tests" -TestPattern "*" -Coverage
}

# Generate test summary
Write-Status "Generating test reports..."

$summaryContent = @"
# Test Summary Report

## Test Results
- **Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
- **Node.js Version**: $nodeVersion
- **npm Version**: $npmVersion
- **PowerShell Version**: $($PSVersionTable.PSVersion)

## Test Suites Results
"@

foreach ($test in $testResults.GetEnumerator()) {
    $status = if ($test.Value) { "✅ PASSED" } else { "❌ FAILED" }
    $summaryContent += "`n- **$($test.Key)**: $status"
}

$summaryContent += @"

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

## Coverage Report
"@

if (Test-Path "coverage/lcov-report/index.html") {
    $summaryContent += "See coverage/lcov-report/index.html for detailed coverage report."
} else {
    $summaryContent += "Coverage report not generated. Run with coverage option to generate."
}

# Write summary to file
$summaryContent | Out-File -FilePath "coverage/test-summary.md" -Encoding UTF8

Write-Success "Test summary generated: coverage/test-summary.md"

# Check if coverage report exists
if (Test-Path "coverage/lcov-report/index.html") {
    Write-Success "Coverage report generated: coverage/lcov-report/index.html"
    Write-Status "Open coverage/lcov-report/index.html in your browser to view detailed coverage"
}

# Final status
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan

$passedTests = ($testResults.Values | Where-Object { $_ -eq $true }).Count
$totalTests = $testResults.Count

if ($passedTests -eq $totalTests) {
    Write-Success "All test suites passed! ($passedTests/$totalTests)"
} else {
    Write-Warning "Some test suites failed or had warnings ($passedTests/$totalTests passed)"
}

Write-Host "📊 Check coverage/test-summary.md for summary" -ForegroundColor Cyan
Write-Host "🌐 Open coverage/lcov-report/index.html for detailed coverage" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Exit with appropriate code
if ($passedTests -eq $totalTests) {
    exit 0
} else {
    exit 1
}
