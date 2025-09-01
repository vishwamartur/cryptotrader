#!/usr/bin/env node

/**
 * Coverage Threshold Checker
 * Validates that test coverage meets the minimum threshold requirements
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = process.env.COVERAGE_THRESHOLD || 80;
const COVERAGE_FILE = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

function checkCoverage() {
  console.log('🔍 Checking test coverage...');
  
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('❌ Coverage file not found:', COVERAGE_FILE);
    console.error('Please run tests with coverage first: npm run test:coverage');
    process.exit(1);
  }

  try {
    const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    const totalCoverage = coverage.total;
    
    console.log('\n📊 Coverage Summary:');
    console.log(`Lines: ${totalCoverage.lines.pct}%`);
    console.log(`Functions: ${totalCoverage.functions.pct}%`);
    console.log(`Branches: ${totalCoverage.branches.pct}%`);
    console.log(`Statements: ${totalCoverage.statements.pct}%`);
    
    const overallCoverage = totalCoverage.lines.pct;
    console.log(`\n🎯 Overall Coverage: ${overallCoverage}%`);
    console.log(`📏 Required Threshold: ${COVERAGE_THRESHOLD}%`);
    
    if (overallCoverage >= COVERAGE_THRESHOLD) {
      console.log(`✅ Coverage check passed! (${overallCoverage}% >= ${COVERAGE_THRESHOLD}%)`);
      process.exit(0);
    } else {
      console.error(`❌ Coverage check failed! (${overallCoverage}% < ${COVERAGE_THRESHOLD}%)`);
      console.error(`Please add more tests to reach the ${COVERAGE_THRESHOLD}% threshold.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error reading coverage file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkCoverage();
}

module.exports = { checkCoverage };
