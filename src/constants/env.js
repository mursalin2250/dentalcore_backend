export const NODE_ENVS = Object.freeze({
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
});

export const DEFAULT_PORT = 5000;
export const DEFAULT_JWT_EXPIRES_IN = "7d";
export const JWT_EXPIRES_IN_PATTERN = /^\d+[smhd]$/; // e.g. 30m, 12h, 7d
export const MIN_JWT_SECRET_LENGTH = 32;
