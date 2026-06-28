/**
 * Statically defined Error Codes for CloudCinema.
 */
export type ErrorCode =
  | "ENV_VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "NAVIGATION_ERROR"
  | "ROUTE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "REPOSITORY_ERROR"
  | "VALIDATION_ERROR"
  | "SUPABASE_CONFIG_ERROR";

/**
 * Custom application-wide base error class.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;

  constructor(message: string, code: ErrorCode = "INTERNAL_ERROR", isOperational = true) {
    super(message);
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintain correct prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Type guard to check if an unknown error is an instance of AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
