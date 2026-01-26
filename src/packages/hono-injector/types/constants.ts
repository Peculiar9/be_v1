export const METADATA = {
  CONTROLLER: Symbol.for('hono-injector:controller'),
  ROUTES: Symbol.for('hono-injector:routes'),
  // Key prefix for storing parameter indices (e.g. which arg is @body, which is @query)
  // We will append method names to this: "params:myMethod"
  PARAMS: Symbol.for('hono-injector:params'),
  // Key prefix for method-level middleware
  MIDDLEWARE: Symbol.for('hono-injector:middleware'),
};