# Architecture & Comparison

`hono-injector` is designed to bring robust Dependency Injection (DI) to Hono without sacrificing the performance characteristics that make Hono great.

## The "Zero Runtime Reflection" Strategy

Many decorator-based frameworks rely on reflection (reading metadata) *during* the request lifecycle to determine how to parse parameters or execute guards. This adds overhead to every single request.

`hono-injector` uses a **Compiler Strategy**:

1.  **Boot Phase**: When you call `registerControllers()`, the library iterates over your controllers and reads all metadata **once**.
2.  **Compilation**: For each route, it constructs a highly optimized interaction closure (the "Handler").
3.  **Optimization**: Parameter extractors (e.g., pulling a query param or body) are pre-selected and placed into a specialized array.
4.  **Runtime (Hot Path)**: When a request comes in, the handler simply executes these pre-compiled extractor functions in a loop. **No `Reflect.getMetadata` calls occur during the request.**

This ensures that your application runs at near-native Hono speeds, even with heavy DI usage.

## Comparison

| Feature | **hono-injector** | **inversify-express-utils** | **NestJS** |
| :--- | :--- | :--- | :--- |
| **Base Framework** | [Hono](https://hono.dev/) (Web Standards) | Express | Express / Fastify |
| **Runtime Reflection** | ❌ **Zero** (Compiled at startup) | ✅ Yes (Often per request) | ⚠️ Mixed (Heavy Guard/Interceptor chains) |
| **Bundle Size** | 🪶 Ultra-light | 🐘 Medium | 🦕 Heavy |
| **DI Container** | InversifyJS | InversifyJS | Custom (Complex) |
| **Cold Start** | ⚡️ Instant | 🐢 Slower | 🧊 Slow (Heavy container init) |
| **Platform** | **Any** (Node, Bun, Workers, Deno) | Node.js only | Node.js primarily |

### vs. `inversify-express-utils`

`inversify-express-utils` is the spiritual predecessor. However, it is tightly coupled to Express.
- **Hono Injector** allows you to run on Cloudflare Workers, Deno, and Bun because it's built on Hono and Web Standards.
- **Request Scoping** is handled automatically in `hono-injector` via a child container per request, ensuring isolation without manual middleware configuration.

### vs. NestJS

NestJS is a full-featured framework including modules, guards, interceptors, and more.
- **Complexity**: NestJS introduces a lot of "Nest-specific" abstractions. `hono-injector` stays out of your way—it just connects Inversify to Hono. You still use standard Hono middleware.
- **Performance**: NestJS provides a lot of value but comes with a performance cost. `hono-injector` aims to be as close to "raw" Hono performance as possible.
- **Type Safety**: Both offer great TypeScript support, but `hono-injector` is simpler to debug as there is less "magic" happening behind the scenes.
