import type { MiddlewareHandler, Context } from 'hono';

// 1. Valid HTTP Methods
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

// 2. The Class Constructor Type (e.g. UserController)
export type ControllerConstructor = new (...args: any[]) => any;

// 3. Data stored on the Class by @controller()
export interface ControllerMetadata {
  path: string; // e.g. "/users"
  middleware: MiddlewareHandler[];
}

// 4. Data stored on methods by @httpGet(), @httpPost()
export interface RouteMetadata {
  method: HttpMethod;
  path: string;       // e.g. "/" or "/:id"
  handlerName: string | symbol; // The name of the function, e.g. "findAll"
  middleware: MiddlewareHandler[];
}

// 5. Data stored on arguments by @body(), @query()
export interface ParameterMetadata {
  index: number; // The position (0 for first arg, 1 for second)
  type: 'body' | 'query' | 'param' | 'header' | 'context';
  name?: string; // e.g. 'id' for @param('id')
}

// 6. Options passed to registerControllers
export interface RegisterOptions {
  prefix?: string; // Global api prefix e.g. "/api/v1"
  globalMiddleware?: MiddlewareHandler[];
  debug?: boolean;
}