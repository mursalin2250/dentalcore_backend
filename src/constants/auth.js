export const COOKIE_NAME = "dentalcore_token";
export const COOKIE_SAME_SITE = "lax";

export const SALT_ROUNDS = 12;

// Compared against when the email is unknown, so response time does not reveal which emails exist.
export const DUMMY_PASSWORD_HASH =
  "$2b$12$EzP58.gcdIeFE7IIro5s3eucOmK02qUGFj8iQ5yhURGt5pkPaqz6i";

export const PASSWORD_RULES = Object.freeze({
  MIN_LENGTH: 8,
  MAX_LENGTH: 72, // bcrypt ignores anything past 72 bytes
});

export const AUTH_RATE_LIMIT = Object.freeze({
  WINDOW_MS: 15 * 60 * 1000,
  MAX_REQUESTS: 20,
});
