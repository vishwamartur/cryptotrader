/**
 * Comprehensive Error Handling System for CryptoTrader
 * Implements structured error types, retry logic, and circuit breakers
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  TRADING_ERROR = 'TRADING_ERROR',
  RISK_MANAGEMENT_ERROR = 'RISK_MANAGEMENT_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  correlationId: string;
  timestamp: number;
  requestId?: string;
  userId?: string;
  symbol?: string;
  operation?: string;
  requestDetails?: any;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export class TradingError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    retryable: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = 'TradingError';
    this.type = type;
    this.severity = severity;
    this.retryable = retryable;
    this.statusCode = statusCode;
    
    this.context = {
      correlationId: context.correlationId || generateCorrelationId(),
      timestamp: context.timestamp || Date.now(),
      ...context
    };

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TradingError);
    }
    this.context.stackTrace = this.stack;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      retryable: this.retryable,
      statusCode: this.statusCode,
      context: this.context
    };
  }
}

// Specific Error Classes
export class NetworkError extends TradingError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, ErrorType.NETWORK_ERROR, ErrorSeverity.HIGH, context, true);
    this.name = 'NetworkError';
  }
}

export class APIError extends TradingError {
  constructor(
    message: string, 
    statusCode: number, 
    context: Partial<ErrorContext> = {}
  ) {
    const severity = statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    const retryable = statusCode >= 500 || statusCode === 429;
    super(message, ErrorType.API_ERROR, severity, context, retryable, statusCode);
    this.name = 'APIError';
  }
}

export class ValidationError extends TradingError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, ErrorType.VALIDATION_ERROR, ErrorSeverity.LOW, context, false);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends TradingError {
  public readonly retryAfter?: number;

  constructor(
    message: string, 
    retryAfter?: number, 
    context: Partial<ErrorContext> = {}
  ) {
    super(message, ErrorType.RATE_LIMIT_ERROR, ErrorSeverity.MEDIUM, context, true, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends TradingError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, ErrorType.AUTHENTICATION_ERROR, ErrorSeverity.CRITICAL, context, false, 401);
    this.name = 'AuthenticationError';
  }
}

export class TradingOperationError extends TradingError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, ErrorType.TRADING_ERROR, ErrorSeverity.HIGH, context, false);
    this.name = 'TradingOperationError';
  }
}

export class RiskManagementError extends TradingError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, ErrorType.RISK_MANAGEMENT_ERROR, ErrorSeverity.CRITICAL, context, false);
    this.name = 'RiskManagementError';
  }
}

// Utility Functions
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof TradingError) {
    return error.retryable;
  }
  
  // Network errors are generally retryable
  if (error.name === 'NetworkError' || error.message.includes('ECONNRESET')) {
    return true;
  }
  
  return false;
}

export function getErrorSeverity(error: Error): ErrorSeverity {
  if (error instanceof TradingError) {
    return error.severity;
  }
  
  return ErrorSeverity.MEDIUM;
}

export function createErrorFromResponse(
  response: Response, 
  context: Partial<ErrorContext> = {}
): TradingError {
  const statusCode = response.status;
  
  if (statusCode === 429) {
    const retryAfter = response.headers.get('retry-after');
    return new RateLimitError(
      'Rate limit exceeded',
      retryAfter ? parseInt(retryAfter) : undefined,
      context
    );
  }
  
  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError('Authentication failed', context);
  }
  
  return new APIError(
    `API request failed with status ${statusCode}`,
    statusCode,
    context
  );
}

// Error Classification Helper
export function classifyError(error: any): TradingError {
  if (error instanceof TradingError) {
    return error;
  }
  
  const message = error.message || 'Unknown error';
  const context: Partial<ErrorContext> = {
    additionalData: { originalError: error }
  };
  
  // Network-related errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
      error.code === 'ETIMEDOUT' || error.name === 'NetworkError') {
    return new NetworkError(message, context);
  }
  
  // Validation errors
  if (error.name === 'ValidationError' || message.includes('validation')) {
    return new ValidationError(message, context);
  }
  
  // Default to system error
  return new TradingError(
    message,
    ErrorType.SYSTEM_ERROR,
    ErrorSeverity.MEDIUM,
    context
  );
}
