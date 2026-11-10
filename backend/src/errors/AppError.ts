import type { ApiValidationErrorDetail, ErrorCode } from '@shared/types/api.types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ApiValidationErrorDetail[];
  public readonly isOperational: boolean = true;

  constructor(
    code: ErrorCode,
    statusCode: number,
    details?: ApiValidationErrorDetail[],
    message?: string
  ) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
