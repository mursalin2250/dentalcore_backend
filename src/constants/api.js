export const API_PREFIX = "/api/v1";

export const ROUTE_PATHS = Object.freeze({
  ROOT: "/",
  BY_ID: "/:id",
  HEALTH: "/health",
  AUTH: "/auth",
  REGISTER: "/register",
  LOGIN: "/login",
  LOGOUT: "/logout",
  ME: "/me",
  TEAM: "/team",
  DASHBOARD: "/dashboard",
  SUMMARY: "/summary",
  REVENUE: "/revenue",
  UPCOMING_APPOINTMENTS: "/appointments/upcoming",
  LOW_STOCK: "/stock/low",
  ACTIVITY: "/activity",
  DOCTORS: "/doctors",
  PATIENTS: "/patients",
  APPOINTMENTS: "/appointments",
  MEDICATIONS: "/medications",
  STOCK_MOVEMENTS: "/stock-movements",
  STATS: "/stats",
  CALENDAR: "/calendar",
  NOTES: "/notes",
  BULK: "/bulk",
});

export const REQUEST_PARTS = Object.freeze({
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
});

export const REQUEST_BODY_LIMIT = "2mb";
export const SHUTDOWN_TIMEOUT_MS = 10_000;
