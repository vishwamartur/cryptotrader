#!/usr/bin/env node

/**
 * Coverage Artifacts Checker for CryptoTrader Project
 * 
 * This script helps prevent accidental commits of coverage artifacts
 * by checking for coverage files in the git staging area.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const COVERAGE_PATTERNS = [
  'coverage/',
  '*.lcov',
  'nyc_output/',
  '.nyc_output/',
  'lcov-report/',
  'coverage-summary.json'
];

const ALLOWED_COVERAGE_FILES = [
  'coverage/.gitkeep',  // Allow gitkeep files
  'jest.config.js',     // Configuration files are OK
  'package.json'        // Package.json is OK
];

function checkStagedFiles() {
  try {
    // Get list of staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file.trim() !== '');

    console.log('🔍 Checking staged files for coverage artifacts...');
    
    if (stagedFiles.length === 0) {
      console.log('✅ No staged files found.');
      return true;
    }

    const coverageFiles = [];
    
    stagedFiles.forEach(file => {
      const isAllowed = ALLOWED_COVERAGE_FILES.some(allowed => 
        file.endsWith(allowed) || file === allowed
      );
      
      if (!isAllowed) {
        const isCoverageFile = COVERAGE_PATTERNS.some(pattern => {
          if (pattern.endsWith('/')) {
            return file.startsWith(pattern);
          }
          return file.includes(pattern) || file.endsWith(pattern);
        });
        
        if (isCoverageFile) {
          coverageFiles.push(file);
        }
      }
    });

    if (coverageFiles.length > 0) {
      console.error('❌ Coverage artifacts detected in staging area:');
      coverageFiles.forEach(file => {
        console.error(`   - ${file}`);
      });
      
      console.error('\n💡 To fix this issue:');
      console.error('   1. Remove coverage files from staging:');
      console.error('      git reset HEAD coverage/');
      console.error('   2. Or remove them completely:');
      console.error('      git rm -r --cached coverage/');
      console.error('   3. Make sure .gitignore includes coverage patterns');
      console.error('\n🔧 Coverage files should be generated locally and in CI/CD only.');
      
      return false;
    }

    console.log(`✅ Checked ${stagedFiles.length} staged files - no coverage artifacts found.`);
    return true;

  } catch (error) {
    console.error('❌ Error checking staged files:', error.message);
    return false;
  }
}

function checkGitignore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    console.warn('⚠️  No .gitignore file found');
    return false;
  }

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  const requiredPatterns = ['/coverage', '*.lcov', '/nyc_output', '/.nyc_output'];
  const missingPatterns = [];

  requiredPatterns.forEach(pattern => {
    if (!gitignoreContent.includes(pattern)) {
      missingPatterns.push(pattern);
    }
  });

  if (missingPatterns.length > 0) {
    console.warn('⚠️  Missing coverage patterns in .gitignore:');
    missingPatterns.forEach(pattern => {
      console.warn(`   - ${pattern}`);
    });
    return false;
  }

  console.log('✅ .gitignore properly configured for coverage files');
  return true;
}

function checkExistingCoverageFiles() {
  const coverageDir = path.join(process.cwd(), 'coverage');
  
  if (fs.existsSync(coverageDir)) {
    try {
      // Check if coverage directory is tracked by git
      const trackedFiles = execSync('git ls-files coverage/', { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim() !== '');

      if (trackedFiles.length > 0) {
        console.warn('⚠️  Coverage files are currently tracked by git:');
        trackedFiles.forEach(file => {
          console.warn(`   - ${file}`);
        });
        console.warn('\n💡 To remove them from git tracking:');
        console.warn('   git rm -r --cached coverage/');
        console.warn('   git commit -m "Remove coverage artifacts from repository"');
        return false;
      }
    } catch (error) {
      // If git ls-files fails, coverage files are likely not tracked (which is good)
    }
  }

  return true;
}

function main() {
  console.log('🧪 CryptoTrader Coverage Artifacts Checker\n');

  const checks = [
    { name: 'Staged Files', fn: checkStagedFiles },
    { name: 'Gitignore Configuration', fn: checkGitignore },
    { name: 'Existing Coverage Files', fn: checkExistingCoverageFiles }
  ];

  let allPassed = true;

  checks.forEach(({ name, fn }) => {
    console.log(`\n📋 ${name}:`);
    const passed = fn();
    if (!passed) {
      allPassed = false;
    }
  });

  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('✅ All coverage artifact checks passed!');
    console.log('🚀 Safe to commit - no coverage artifacts detected.');
    process.exit(0);
  } else {
    console.log('❌ Coverage artifact checks failed!');
    console.log('🛑 Please fix the issues above before committing.');
    process.exit(1);
  }
}

// Run the checks
if (require.main === module) {
  main();
}

module.exports = {
  checkStagedFiles,
  checkGitignore,
  checkExistingCoverageFiles
};
