#!/usr/bin/env node

/**
 * Comprehensive Test Report Generator
 * Aggregates results from all test suites and generates detailed reports
 */

const fs = require('fs');
const path = require('path');

class TestReportGenerator {
  constructor() {
    this.reportData = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: {},
      coverage: {},
      performance: {},
      security: {},
      recommendations: []
    };
  }

  async generateReport() {
    console.log('🧪 Generating comprehensive test report...');

    try {
      // Collect data from all test suites
      await this.collectUnitTestResults();
      await this.collectIntegrationTestResults();
      await this.collectSecurityTestResults();
      await this.collectPerformanceTestResults();
      await this.collectUATResults();
      await this.collectCoverageData();

      // Generate summary
      this.generateSummary();

      // Generate recommendations
      this.generateRecommendations();

      // Write reports
      await this.writeReports();

      console.log('✅ Test report generation completed successfully');
    } catch (error) {
      console.error('❌ Error generating test report:', error);
      process.exit(1);
    }
  }

  async collectUnitTestResults() {
    console.log('📊 Collecting unit test results...');
    
    const unitTestResults = {
      status: 'passed',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      duration: 0,
      coverage: 0
    };

    // Try to read Jest test results
    try {
      const jestResults = this.readJestResults('unit');
      if (jestResults) {
        unitTestResults.totalTests = jestResults.numTotalTests;
        unitTestResults.passedTests = jestResults.numPassedTests;
        unitTestResults.failedTests = jestResults.numFailedTests;
        unitTestResults.duration = jestResults.testResults.reduce((sum, result) => 
          sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) / 1000;
        unitTestResults.status = jestResults.success ? 'passed' : 'failed';
      }
    } catch (error) {
      console.warn('⚠️ Could not read unit test results:', error.message);
      unitTestResults.status = 'unknown';
    }

    this.reportData.details.unit = unitTestResults;
  }

  async collectIntegrationTestResults() {
    console.log('🔗 Collecting integration test results...');
    
    const integrationResults = {
      status: 'passed',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      duration: 0,
      apiEndpointsCovered: 0
    };

    try {
      const jestResults = this.readJestResults('integration');
      if (jestResults) {
        integrationResults.totalTests = jestResults.numTotalTests;
        integrationResults.passedTests = jestResults.numPassedTests;
        integrationResults.failedTests = jestResults.numFailedTests;
        integrationResults.duration = jestResults.testResults.reduce((sum, result) => 
          sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) / 1000;
        integrationResults.status = jestResults.success ? 'passed' : 'failed';
        
        // Count API endpoints tested
        integrationResults.apiEndpointsCovered = this.countApiEndpointsCovered(jestResults);
      }
    } catch (error) {
      console.warn('⚠️ Could not read integration test results:', error.message);
      integrationResults.status = 'unknown';
    }

    this.reportData.details.integration = integrationResults;
  }

  async collectSecurityTestResults() {
    console.log('🔒 Collecting security test results...');
    
    const securityResults = {
      status: 'passed',
      vulnerabilitiesFound: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      duration: 0
    };

    try {
      const jestResults = this.readJestResults('security');
      if (jestResults) {
        securityResults.duration = jestResults.testResults.reduce((sum, result) => 
          sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) / 1000;
        securityResults.status = jestResults.success ? 'passed' : 'failed';
      }

      // Try to read security scan results
      const securityScanPath = path.join(process.cwd(), 'security-reports', 'scan-results.json');
      if (fs.existsSync(securityScanPath)) {
        const scanResults = JSON.parse(fs.readFileSync(securityScanPath, 'utf8'));
        securityResults.vulnerabilitiesFound = scanResults.vulnerabilities?.length || 0;
        securityResults.criticalIssues = scanResults.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
        securityResults.highIssues = scanResults.vulnerabilities?.filter(v => v.severity === 'high').length || 0;
        securityResults.mediumIssues = scanResults.vulnerabilities?.filter(v => v.severity === 'medium').length || 0;
        securityResults.lowIssues = scanResults.vulnerabilities?.filter(v => v.severity === 'low').length || 0;
      }
    } catch (error) {
      console.warn('⚠️ Could not read security test results:', error.message);
      securityResults.status = 'unknown';
    }

    this.reportData.details.security = securityResults;
  }

  async collectPerformanceTestResults() {
    console.log('⚡ Collecting performance test results...');
    
    const performanceResults = {
      status: 'passed',
      benchmarks: {},
      budgetsMet: true,
      duration: 0
    };

    try {
      const jestResults = this.readJestResults('performance');
      if (jestResults) {
        performanceResults.duration = jestResults.testResults.reduce((sum, result) => 
          sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) / 1000;
        performanceResults.status = jestResults.success ? 'passed' : 'failed';
      }

      // Try to read performance benchmark results
      const benchmarkPath = path.join(process.cwd(), 'performance-reports', 'benchmarks.json');
      if (fs.existsSync(benchmarkPath)) {
        const benchmarks = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
        performanceResults.benchmarks = benchmarks;
        
        // Check if performance budgets are met
        performanceResults.budgetsMet = this.checkPerformanceBudgets(benchmarks);
      }
    } catch (error) {
      console.warn('⚠️ Could not read performance test results:', error.message);
      performanceResults.status = 'unknown';
    }

    this.reportData.details.performance = performanceResults;
  }

  async collectUATResults() {
    console.log('👤 Collecting UAT results...');
    
    const uatResults = {
      status: 'passed',
      workflowsTested: 0,
      workflowsPassed: 0,
      workflowsFailed: 0,
      duration: 0
    };

    try {
      const jestResults = this.readJestResults('uat');
      if (jestResults) {
        uatResults.workflowsTested = jestResults.numTotalTests;
        uatResults.workflowsPassed = jestResults.numPassedTests;
        uatResults.workflowsFailed = jestResults.numFailedTests;
        uatResults.duration = jestResults.testResults.reduce((sum, result) => 
          sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) / 1000;
        uatResults.status = jestResults.success ? 'passed' : 'failed';
      }
    } catch (error) {
      console.warn('⚠️ Could not read UAT results:', error.message);
      uatResults.status = 'unknown';
    }

    this.reportData.details.uat = uatResults;
  }

  async collectCoverageData() {
    console.log('📈 Collecting coverage data...');
    
    const coverageData = {
      overall: 0,
      lines: 0,
      functions: 0,
      branches: 0,
      statements: 0,
      thresholdMet: false
    };

    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        
        if (coverage.total) {
          coverageData.lines = parseFloat(coverage.total.lines.pct) || 0;
          coverageData.functions = parseFloat(coverage.total.functions.pct) || 0;
          coverageData.branches = parseFloat(coverage.total.branches.pct) || 0;
          coverageData.statements = parseFloat(coverage.total.statements.pct) || 0;
          
          // Calculate overall coverage (weighted average)
          coverageData.overall = (
            coverageData.lines * 0.4 +
            coverageData.functions * 0.3 +
            coverageData.branches * 0.2 +
            coverageData.statements * 0.1
          );
          
          coverageData.thresholdMet = coverageData.overall >= 80;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not read coverage data:', error.message);
    }

    this.reportData.coverage = coverageData;
  }

  generateSummary() {
    console.log('📋 Generating summary...');
    
    const details = this.reportData.details;
    const coverage = this.reportData.coverage;

    this.reportData.summary = {
      overall: {
        status: this.calculateOverallStatus(),
        coverage: coverage.overall,
        duration: Object.values(details).reduce((sum, detail) => sum + (detail.duration || 0), 0)
      },
      unit: {
        status: details.unit?.status || 'unknown',
        coverage: coverage.lines,
        duration: details.unit?.duration || 0
      },
      integration: {
        status: details.integration?.status || 'unknown',
        coverage: coverage.functions,
        duration: details.integration?.duration || 0
      },
      security: {
        status: details.security?.status || 'unknown',
        duration: details.security?.duration || 0
      },
      performance: {
        status: details.performance?.status || 'unknown',
        budget_met: details.performance?.budgetsMet || false,
        duration: details.performance?.duration || 0
      },
      uat: {
        status: details.uat?.status || 'unknown',
        duration: details.uat?.duration || 0
      }
    };
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];
    const coverage = this.reportData.coverage;
    const details = this.reportData.details;

    // Coverage recommendations
    if (coverage.overall < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'high',
        message: `Code coverage is ${coverage.overall.toFixed(1)}%, below the 80% threshold. Focus on testing uncovered branches and functions.`
      });
    }

    // Security recommendations
    if (details.security?.criticalIssues > 0) {
      recommendations.push({
        type: 'security',
        priority: 'critical',
        message: `${details.security.criticalIssues} critical security issues found. Address immediately before deployment.`
      });
    }

    // Performance recommendations
    if (!details.performance?.budgetsMet) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Performance budgets not met. Review slow operations and optimize critical paths.'
      });
    }

    // Test failure recommendations
    const failedSuites = Object.entries(details).filter(([_, detail]) => detail.status === 'failed');
    if (failedSuites.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `${failedSuites.length} test suite(s) failing: ${failedSuites.map(([name]) => name).join(', ')}. Fix failing tests before deployment.`
      });
    }

    this.reportData.recommendations = recommendations;
  }

  async writeReports() {
    console.log('📝 Writing reports...');
    
    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Write JSON report
    const jsonReportPath = path.join(reportsDir, 'comprehensive-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.reportData, null, 2));

    // Write summary JSON for CI
    const summaryPath = path.join(reportsDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(this.reportData.summary, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(reportsDir, 'comprehensive-report.html');
    fs.writeFileSync(htmlReportPath, this.generateHTMLReport());

    // Write markdown report
    const mdReportPath = path.join(reportsDir, 'comprehensive-report.md');
    fs.writeFileSync(mdReportPath, this.generateMarkdownReport());

    console.log(`📊 Reports generated:`);
    console.log(`  - JSON: ${jsonReportPath}`);
    console.log(`  - HTML: ${htmlReportPath}`);
    console.log(`  - Markdown: ${mdReportPath}`);
  }

  // Helper methods
  readJestResults(testType) {
    const resultsPath = path.join(process.cwd(), 'test-results', `${testType}-results.json`);
    if (fs.existsSync(resultsPath)) {
      return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    }
    return null;
  }

  countApiEndpointsCovered(jestResults) {
    // Count unique API endpoints tested based on test names
    const endpoints = new Set();
    jestResults.testResults.forEach(result => {
      result.assertionResults.forEach(assertion => {
        const match = assertion.title.match(/\/api\/[^\s]+/);
        if (match) {
          endpoints.add(match[0]);
        }
      });
    });
    return endpoints.size;
  }

  checkPerformanceBudgets(benchmarks) {
    // Check if all benchmarks meet their budgets
    const budgets = {
      backtesting: 10000, // 10 seconds
      apiResponse: 2000,  // 2 seconds
      memoryUsage: 500    // 500MB
    };

    return Object.entries(benchmarks).every(([key, value]) => {
      const budget = budgets[key];
      return !budget || value <= budget;
    });
  }

  calculateOverallStatus() {
    const statuses = Object.values(this.reportData.details).map(detail => detail.status);
    
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('unknown')) return 'unknown';
    if (this.reportData.coverage.overall < 80) return 'warning';
    
    return 'passed';
  }

  generateHTMLReport() {
    // Generate a comprehensive HTML report
    return `
<!DOCTYPE html>
<html>
<head>
    <title>CryptoTrader Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
        .warning { border-left: 4px solid #ffc107; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CryptoTrader Comprehensive Test Report</h1>
        <p>Generated: ${this.reportData.timestamp}</p>
        <p>Overall Status: <strong>${this.reportData.summary.overall.status.toUpperCase()}</strong></p>
    </div>
    
    <div class="summary">
        ${Object.entries(this.reportData.summary).filter(([key]) => key !== 'overall').map(([key, data]) => `
            <div class="card ${data.status}">
                <h3>${key.charAt(0).toUpperCase() + key.slice(1)} Tests</h3>
                <p>Status: ${data.status}</p>
                <p>Duration: ${data.duration?.toFixed(2) || 0}s</p>
                ${data.coverage ? `<p>Coverage: ${data.coverage.toFixed(1)}%</p>` : ''}
            </div>
        `).join('')}
    </div>
    
    ${this.reportData.recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${this.reportData.recommendations.map(rec => `
                    <li><strong>${rec.priority.toUpperCase()}:</strong> ${rec.message}</li>
                `).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
  }

  generateMarkdownReport() {
    return `# CryptoTrader Test Report

**Generated:** ${this.reportData.timestamp}
**Overall Status:** ${this.reportData.summary.overall.status.toUpperCase()}

## Summary

| Test Suite | Status | Coverage | Duration |
|------------|--------|----------|----------|
${Object.entries(this.reportData.summary).filter(([key]) => key !== 'overall').map(([key, data]) => 
  `| ${key.charAt(0).toUpperCase() + key.slice(1)} | ${data.status} | ${data.coverage?.toFixed(1) || 'N/A'}% | ${data.duration?.toFixed(2) || 0}s |`
).join('\n')}

## Coverage Details

- **Overall Coverage:** ${this.reportData.coverage.overall.toFixed(1)}%
- **Lines:** ${this.reportData.coverage.lines.toFixed(1)}%
- **Functions:** ${this.reportData.coverage.functions.toFixed(1)}%
- **Branches:** ${this.reportData.coverage.branches.toFixed(1)}%
- **Statements:** ${this.reportData.coverage.statements.toFixed(1)}%

${this.reportData.recommendations.length > 0 ? `
## Recommendations

${this.reportData.recommendations.map(rec => 
  `- **${rec.priority.toUpperCase()}:** ${rec.message}`
).join('\n')}
` : ''}

## Test Details

${Object.entries(this.reportData.details).map(([key, detail]) => `
### ${key.charAt(0).toUpperCase() + key.slice(1)} Tests

- Status: ${detail.status}
- Duration: ${detail.duration?.toFixed(2) || 0}s
${detail.totalTests ? `- Total Tests: ${detail.totalTests}` : ''}
${detail.passedTests ? `- Passed: ${detail.passedTests}` : ''}
${detail.failedTests ? `- Failed: ${detail.failedTests}` : ''}
`).join('')}
`;
  }
}

// Run the report generator
if (require.main === module) {
  const generator = new TestReportGenerator();
  generator.generateReport().catch(console.error);
}

module.exports = TestReportGenerator;
