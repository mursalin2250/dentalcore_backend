// An error we expect and can explain to the client (bad input, no permission, ...).
export class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors; // optional { field: message } map
    this.isOperational = true;
  }
}
