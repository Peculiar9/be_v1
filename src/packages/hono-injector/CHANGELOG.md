# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-03-20

### 🚀 Launched
- **Core**: Initial release of `hono-injector`.
- **DI**: Full [InversifyJS](https://github.com/inversify/InversifyJS) integration.
- **Routing**: Class-based routing with `@controller`, `@httpGet`, `@httpPost`, etc.
- **Performance**: "Compiling" strategy for Zero Runtime Reflection in the hot path.
- **Support**: 
    - Full support for **Hono v4**.
    - Compatible with Node.js, Bun, and Cloudflare Workers (Platform agnostic).

### ✨ Features
- **Decorators**: factory-based decorators for explicit and type-safe metadata.
- **Parameter Injection**: `@body`, `@query`, `@param`, `@header`, and full `@ctx` injection.
- **Middleware**: Support for method-level and controller-level Hono middleware via `@middleware`.
- **Scoping**: Automatic Request Scope support (child container per request).

### 🐛 Fixes
- Addressed strict type checking issues with `target: Function` vs `target: any` in decorators.
