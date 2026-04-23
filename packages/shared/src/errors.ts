export class AppError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, opts?: { retryable?: boolean; cause?: unknown }) {
    super(message, { cause: opts?.cause });
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = opts?.retryable ?? false;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("validation_error", message, { retryable: false, cause: opts?.cause });
  }
}

export class ExtractionError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("extraction_error", message, { retryable: true, cause: opts?.cause });
  }
}

export class ArcaLoginError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("arca_login_error", message, { retryable: true, cause: opts?.cause });
  }
}

export class ArcaRateLimitError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("arca_rate_limit_error", message, { retryable: true, cause: opts?.cause });
  }
}

export class ArcaSessionExpiredError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("arca_session_expired_error", message, { retryable: true, cause: opts?.cause });
  }
}
