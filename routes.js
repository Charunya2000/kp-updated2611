/**
 * An array of routes that are accessible to anyone
 * @type {string[]}
 */
export const publicRoutes = ["/", "/livenessprobe", "/health", "/admin", "api/proxy", '/no-assistants', '/error', '/api/nps', '/api/statistics'];

export const internalRoutes = [
  "/api/user",
  "/api/snow"
];

/**
 * An array of routes that are used to log in and out
 * @type {string[]}
 */
export const authRoutes = ["/login"];

/**
 * The prefix for authoirziton routes used by Auth.js
 * @type {string}
 */
export const apiAuthPrefix = "/api/auth";

export const apiAdminPreix = "/api/admin"

export const LOGIN_REDIRECT = "/";
