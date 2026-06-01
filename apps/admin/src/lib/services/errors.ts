export class ServiceError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message = "Recurso no encontrado") {
    super(message, "not_found");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = "No tienes permiso para esta acción") {
    super(message, "forbidden");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message = "Estado inválido para esta acción") {
    super(message, "conflict");
    this.name = "ConflictError";
  }
}

export class ValidationError extends ServiceError {
  constructor(message = "Datos inválidos") {
    super(message, "validation");
    this.name = "ValidationError";
  }
}

export function httpStatusForServiceError(error: unknown): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof ConflictError) return 409;
  if (error instanceof ValidationError) return 400;
  return 500;
}
