import 'reflect-metadata';
import { Hono, type Context, type MiddlewareHandler, type Next } from 'hono';
import { Container } from 'inversify';
import { METADATA } from '../types/constants';
import { getParameterMetadata, getMethodMiddleware } from '../decorators/decorators';
import type {
  ControllerConstructor,
  ControllerMetadata,
  RouteMetadata,
  ParameterMetadata,
  RegisterOptions,
} from '../types/types.js';

// Define a type for our pre-compiled extractor functions
type ParamExtractor = (c: Context) => Promise<any> | any;

/**
 * Registers controllers with Hono using a "Compiling" strategy.
 * This moves reflection overhead to the startup phase.
 */
export function registerControllers(
  app: Hono,
  container: Container,
  controllers: ControllerConstructor[],
  options: RegisterOptions = {}
): Hono {
  const { prefix = '', globalMiddleware = [], debug = false } = options;

  // 1. GLOBAL SCOPE MIDDLEWARE
  // We must create a child container for every request to ensure
  // "inRequestScope" dependencies are actually isolated.
  app.use('*', async (c: Context, next: Next) => {
    const requestContainer = container.createChild();
    c.set('container', requestContainer);
    await next();
    // In a more complex setup, we might emit an event here to clean up resources
  });

  for (const Controller of controllers) {
    // 2. REFLECTION (Happens ONCE at startup)
    const controllerMeta: ControllerMetadata | undefined =
      Reflect.getMetadata(METADATA.CONTROLLER, Controller);

    if (!controllerMeta) continue;

    // Ensure Controller is bound.
    // If it's not bound, we bind it to the Root container.
    // The Child container will be able to resolve it.
    if (!container.isBound(Controller)) {
      container.bind(Controller).toSelf().inRequestScope();
    }

    const routes: RouteMetadata[] = Reflect.getMetadata(METADATA.ROUTES, Controller) || [];

    for (const route of routes) {
      const fullPath = buildPath(prefix, controllerMeta.path, route.path);

      // 3. COMPILE MIDDLEWARE STACK
      const decoratorMiddleware = getMethodMiddleware(Controller, route.handlerName);
      const allMiddleware: MiddlewareHandler[] = [
        ...globalMiddleware,
        ...controllerMeta.middleware,
        ...decoratorMiddleware,
        ...route.middleware,
      ];

      // 4. COMPILE THE HANDLER
      // We generate the optimized function closure here.
      const optimizedHandler = createOptimizedHandler(Controller, route);

      if (debug) {
        console.log(`[hono-injector] mapped ${route.method.toUpperCase()} ${fullPath}`);
      }

      // Register with Hono
      (app as any)[route.method](fullPath, ...allMiddleware, optimizedHandler);
    }
  }

  return app;
}

/**
 * FACTORY FUNCTION
 * Creates a handler that has ZERO reflection overhead at runtime.
 */
function createOptimizedHandler(
  Controller: ControllerConstructor,
  route: RouteMetadata
): (c: Context) => Promise<Response | void> {
  
  // A. PRE-CALCULATION PHASE (Boot Time)
  const handlerName = route.handlerName;
  const paramMeta = getParameterMetadata(Controller, handlerName);

  // Convert metadata into executable functions.
  // We sort and map ONCE.
  const extractors: ParamExtractor[] = paramMeta
    .sort((a, b) => a.index - b.index)
    .map(param => compileExtractor(param));

  // B. RUNTIME PHASE (Hot Path)
  // This is the function Hono actually calls.
  return async (c: Context) => {
    // 1. Get the Request-Scoped Container
    // This allows TransactionService or UserContext to be shared
    // across services for this specific request only.
    const scopedContainer = c.get('container') as Container;
    
    // 2. Resolve Controller (Fast resolution)
    const instance = scopedContainer.get(Controller);

    // 3. Execute Extractors
    // We loop over our pre-compiled functions. No switches, no lookups.
    const args = new Array(extractors.length);
    try {
      for (let i = 0; i < extractors.length; i++) {
        args[i] = await extractors[i](c);
      }
    } catch (err) {
      // Safety: If body parsing fails, don't swallow it.
      // We can delegate to global error handler or throw 400.
      if (err instanceof SyntaxError) {
        return c.json({ error: 'Invalid JSON body' }, 400);
      }
      throw err;
    }

    // 4. Invoke Method
    const result = await instance[handlerName](...args);

    // 5. Handle Response
    if (result === undefined || result === null) return;
    if (result instanceof Response) return result;
    if (typeof result === 'object') return c.json(result);
    return c.text(String(result));
  };
}

/**
 * HELPER: Compiles a single parameter metadata into a function
 */
function compileExtractor(param: ParameterMetadata): ParamExtractor {
  switch (param.type) {
    case 'context':
      return (c) => c;
    
    case 'body':
      return async (c) => {
        const contentType = c.req.header('Content-Type');
        if (!contentType?.includes('application/json')) return {};
        return await c.req.json(); 
      };
    
    case 'param':
      if (param.name) return (c) => c.req.param(param.name!);
      return (c) => c.req.param();
    
    case 'query':
      if (param.name) return (c) => c.req.query(param.name!);
      return (c) => c.req.query();
    
    case 'header':
      if (param.name) return (c) => c.req.header(param.name!);
      return (c) => c.req.header();
      
    default:
      return () => undefined;
  }
}

function buildPath(...segments: string[]): string {
  const joined = segments.filter(Boolean).join('/');
  let normalized = joined.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}