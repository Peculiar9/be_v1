import 'reflect-metadata';
import { injectable } from 'inversify';
import type { MiddlewareHandler } from 'hono';
import { METADATA } from '../types/constants';
import type { ControllerMetadata, RouteMetadata, ParameterMetadata, HttpMethod } from '../types/types';

// ============================================================================
// CONTROLLER DECORATOR
// ============================================================================

/**
 * Marks a class as a controller with a base route path.
 * Automatically applies @injectable() from Inversify.
 *
 * @param path - Base path for all routes in this controller
 * @param middleware - Optional middleware applied to all routes
 *
 * @example
 * ```typescript
 * @controller('/users')
 * class UserController {
 *   @httpGet('/')
 *   findAll(c: Context) { ... }
 * }
 *
 * // With middleware
 * @controller('/admin', [authMiddleware])
 * class AdminController { ... }
 * ```
 */
export function controller(path: string, middleware: MiddlewareHandler[] = []) {
    return function (target: any) {
        const metadata: ControllerMetadata = {
            path: normalizePath(path),
            middleware,
        };

        Reflect.defineMetadata(METADATA.CONTROLLER, metadata, target);
        injectable()(target);
    };
}

// ============================================================================
// HTTP METHOD DECORATORS
// ============================================================================

function createMethodDecorator(method: HttpMethod) {
    return function (path: string = '/', middleware: MiddlewareHandler[] = []) {
        return function (
            target: Object,
            propertyKey: string | symbol,
            descriptor: PropertyDescriptor
        ) {
            const routes: RouteMetadata[] =
                Reflect.getMetadata(METADATA.ROUTES, target.constructor) || [];

            routes.push({
                method,
                path: normalizePath(path),
                handlerName: propertyKey,
                middleware,
            });

            Reflect.defineMetadata(METADATA.ROUTES, routes, target.constructor);
            return descriptor;
        };
    };
}

/** GET route */
export const httpGet = createMethodDecorator('get');

/** POST route */
export const httpPost = createMethodDecorator('post');

/** PUT route */
export const httpPut = createMethodDecorator('put');

/** DELETE route */
export const httpDelete = createMethodDecorator('delete');

/** PATCH route */
export const httpPatch = createMethodDecorator('patch');

/** OPTIONS route */
export const httpOptions = createMethodDecorator('options');

/** HEAD route */
export const httpHead = createMethodDecorator('head');

/**
 * Generic route decorator for dynamic method specification
 *
 * @example
 * ```typescript
 * @route('get', '/custom')
 * handler(c: Context) { ... }
 * ```
 */
export function route(method: HttpMethod, path: string = '/', middleware: MiddlewareHandler[] = []) {
    return createMethodDecorator(method)(path, middleware);
}

// ============================================================================
// PARAMETER DECORATORS
// ============================================================================

function createParamDecorator(type: ParameterMetadata['type']) {
    return function (name?: string) {
        return function (
            target: Object,
            propertyKey: string | symbol | undefined,
            parameterIndex: number
        ) {
            if (propertyKey === undefined) return;

            const key = `${METADATA.PARAMS.toString()}:${String(propertyKey)}`;
            const params: ParameterMetadata[] = Reflect.getMetadata(key, target.constructor) || [];

            params.push({ index: parameterIndex, type, name });
            Reflect.defineMetadata(key, params, target.constructor);
        };
    };
}

/** Inject the full Hono Context */
export const ctx = () => createParamDecorator('context')();

/** Inject parsed request body */
export const body = () => createParamDecorator('body')();

/** Inject URL parameter by name */
export const param = (name: string) => createParamDecorator('param')(name);

/** Inject query string parameter by name */
export const query = (name: string) => createParamDecorator('query')(name);

/** Inject request header by name */
export const header = (name: string) => createParamDecorator('header')(name);

// ============================================================================
// MIDDLEWARE DECORATOR
// ============================================================================

/**
 * Applies middleware to a specific route method.
 *
 * @example
 * ```typescript
 * @httpPost('/')
 * @middleware(validateBody, auditLog)
 * create(c: Context) { ... }
 * ```
 */
export function middleware(...handlers: MiddlewareHandler[]) {
    return function (
        target: Object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor
    ) {
        const key = `${METADATA.MIDDLEWARE.toString()}:${String(propertyKey)}`;
        const existing: MiddlewareHandler[] = Reflect.getMetadata(key, target.constructor) || [];

        Reflect.defineMetadata(key, [...handlers, ...existing], target.constructor);
        return descriptor;
    };
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    let normalized = path.startsWith('/') ? path : `/${path}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

/**
 * Get parameter metadata for a method (internal use)
 */
export function getParameterMetadata(target: Function, methodName: string | symbol): ParameterMetadata[] {
    const key = `${METADATA.PARAMS.toString()}:${String(methodName)}`;
    return Reflect.getMetadata(key, target) || [];
}

/**
 * Get middleware metadata for a method (internal use)
 */
export function getMethodMiddleware(target: Function, methodName: string | symbol): MiddlewareHandler[] {
    const key = `${METADATA.MIDDLEWARE.toString()}:${String(methodName)}`;
    return Reflect.getMetadata(key, target) || [];
}