import { FeedbackFlowError as IFeedbackFlowError } from '@/types';

export class FeedbackFlowError extends Error implements IFeedbackFlowError {
  public override readonly name: string = 'FeedbackFlowError';
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeedbackFlowError);
    }
  }
}

export class ValidationError extends FeedbackFlowError {
  public override readonly name: string = 'ValidationError';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400);
    
    if (details) {
      this.message = `${message}: ${JSON.stringify(details)}`;
    }
  }
}

export class NotFoundError extends FeedbackFlowError {
  public override readonly name: string = 'NotFoundError';

  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 'NOT_FOUND', 404);
  }
}

export class DatabaseError extends FeedbackFlowError {
  public override readonly name: string = 'DatabaseError';

  constructor(message: string, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500);
    
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}

export class ExternalApiError extends FeedbackFlowError {
  public override readonly name: string = 'ExternalApiError';
  public readonly service: string;
  public readonly originalStatus: number | undefined;

  constructor(
    service: string, 
    message: string, 
    originalStatus?: number
  ) {
    super(`${service} API error: ${message}`, 'EXTERNAL_API_ERROR', 502);
    this.service = service;
    this.originalStatus = originalStatus;
  }
}

export class RateLimitError extends FeedbackFlowError {
  public override readonly name: string = 'RateLimitError';
  public readonly retryAfter: number | undefined;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

export class ProcessingError extends FeedbackFlowError {
  public override readonly name: string = 'ProcessingError';
  public readonly jobId: string | undefined;
  public readonly stage: string | undefined;

  constructor(
    message: string, 
    jobId?: string, 
    stage?: string
  ) {
    super(message, 'PROCESSING_ERROR', 500);
    this.jobId = jobId;
    this.stage = stage;
  }
}

// Error type guards
export function isFeedbackFlowError(error: unknown): error is FeedbackFlowError {
  return error instanceof FeedbackFlowError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isExternalApiError(error: unknown): error is ExternalApiError {
  return error instanceof ExternalApiError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isProcessingError(error: unknown): error is ProcessingError {
  return error instanceof ProcessingError;
}

// Error formatting utilities
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  if (isFeedbackFlowError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      stack: error.stack,
      ...(isExternalApiError(error) && {
        service: error.service,
        originalStatus: error.originalStatus,
      }),
      ...(isRateLimitError(error) && {
        retryAfter: error.retryAfter,
      }),
      ...(isProcessingError(error) && {
        jobId: error.jobId,
        stage: error.stage,
      }),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    error: String(error),
  };
}

export function formatErrorForClient(error: unknown): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
} {
  const timestamp = new Date();

  if (isFeedbackFlowError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(isValidationError(error) && {
          details: { type: 'validation' },
        }),
        ...(isRateLimitError(error) && error.retryAfter && {
          details: { retryAfter: error.retryAfter },
        }),
      },
      timestamp,
    };
  }

  // Don't expose internal error details to clients
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
    timestamp,
  };
}
