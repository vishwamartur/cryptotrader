# Development Environment Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the CryptoTrader development environment, including all necessary tools, dependencies, and configurations.

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11, macOS 10.15+, or Ubuntu 18.04+
- **RAM**: Minimum 8GB, Recommended 16GB+
- **Storage**: Minimum 10GB free space
- **Network**: Stable internet connection for API access

### Required Software
- **Node.js**: Version 20.x LTS or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: Latest version
- **VS Code**: Recommended IDE with extensions

## Installation Steps

### 1. Node.js and npm Setup

#### Windows
```powershell
# Download and install Node.js from https://nodejs.org/
# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x
```

#### macOS
```bash
# Using Homebrew (recommended)
brew install node@20

# Or download from https://nodejs.org/
# Verify installation
node --version
npm --version
```

#### Linux (Ubuntu/Debian)
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Git Configuration

```bash
# Configure Git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify configuration
git config --list
```

### 3. Clone Repository

```bash
# Clone the repository
git clone https://github.com/vishwamartur/CryptoTrader.git
cd CryptoTrader

# Verify repository structure
ls -la
```

### 4. Install Dependencies

```bash
# Install project dependencies
npm install --legacy-peer-deps

# Verify installation
npm list --depth=0
```

### 5. Environment Configuration

#### Create Environment File
```bash
# Copy example environment file
cp .env.example .env.local

# Edit the environment file with your API keys
```

#### Environment Variables
```env
# Anthropic API (Required for AI features)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Delta Exchange API (Optional - for live trading)
NEXT_PUBLIC_DELTA_API_KEY=your_delta_api_key
NEXT_PUBLIC_DELTA_API_SECRET=your_delta_api_secret
NEXT_PUBLIC_DELTA_BASE_URL=https://api.delta.exchange
NEXT_PUBLIC_DELTA_WS_URL=wss://socket.india.delta.exchange

# Database Configuration (Development)
DATABASE_URL=postgresql://username:password@localhost:5432/cryptotrader_dev

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# JWT Secret (Generate a secure random string)
JWT_SECRET=your_jwt_secret_here

# Environment
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development
```

## Development Tools Setup

### 1. VS Code Extensions

Install the following recommended extensions:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-jest",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-markdown"
  ]
}
```

### 2. VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

### 3. Database Setup (Optional for Development)

#### PostgreSQL Installation
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download and install from https://www.postgresql.org/download/windows/
```

#### Database Creation
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database and user
CREATE DATABASE cryptotrader_dev;
CREATE USER cryptotrader WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cryptotrader_dev TO cryptotrader;
```

### 4. Redis Setup (Optional)

#### Redis Installation
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

## Running the Application

### 1. Development Server

```bash
# Start the development server
npm run dev

# The application will be available at:
# http://localhost:3000
```

### 2. Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern="trading-system.test.ts"
npm test -- --testPathPattern="performance.test.ts"
npm test -- --testPathPattern="integration.test.ts"

# Run tests in watch mode
npm run test:watch
```

### 3. Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type checking
npm run type-check
```

### 4. Build and Production

```bash
# Build for production
npm run build

# Start production server
npm start

# Analyze bundle size
npm run analyze
```

## Development Workflow

### 1. Branch Strategy

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request on GitHub
```

### 2. Code Quality Checks

Before committing, ensure:
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)

### 3. Commit Message Convention

Follow conventional commits format:
```
type(scope): description

feat: add new trading strategy
fix: resolve authentication issue
docs: update API documentation
test: add unit tests for risk management
refactor: improve portfolio optimization
```

## Troubleshooting

### Common Issues

#### 1. Node Version Issues
```bash
# Check Node version
node --version

# If wrong version, install correct version
# Use nvm (Node Version Manager) for easy switching
```

#### 2. Dependency Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### 3. Port Already in Use
```bash
# Kill process using port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

#### 4. Environment Variables Not Loading
```bash
# Verify .env.local exists and has correct format
cat .env.local

# Restart development server
npm run dev
```

### Getting Help

1. **Documentation**: Check the `docs/` directory for detailed guides
2. **GitHub Issues**: Report bugs or request features
3. **GitHub Discussions**: Ask questions and share ideas
4. **Code Comments**: Inline documentation in source code

## Performance Optimization

### Development Performance
- Use `npm run dev` for hot reloading
- Enable VS Code TypeScript performance optimizations
- Use incremental TypeScript compilation
- Optimize VS Code extensions (disable unused ones)

### Testing Performance
- Run specific test suites during development
- Use `--watch` mode for continuous testing
- Parallelize test execution with Jest

## Security Considerations

### API Keys
- Never commit API keys to version control
- Use environment variables for sensitive data
- Rotate API keys regularly
- Use different keys for development and production

### Dependencies
- Regularly update dependencies (`npm audit`)
- Review security advisories
- Use `npm audit fix` for automatic fixes
- Monitor for vulnerable packages

---

**Last Updated**: August 28, 2025  
**Maintained By**: Development Team  
**Next Review**: September 15, 2025
