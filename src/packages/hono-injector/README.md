# Hono Injector

> Inversify + Hono = ⚡️

Decorator-based routing and dependency injection for [Hono](https://hono.dev/), heavily inspired by `inversify-express-utils`.

## Features

- 🏗 **Class-based Controllers**: Organize your routes using classes.
- 💉 **Dependency Injection**: Full support for InversifyJS.
- 🎨 **Decorators**: `@controller`, `@httpGet`, `@middleware`, and more.
- 🚀 **Lightweight**: Built on top of Hono's blazing fast router.
- ⚡️ **Zero Runtime Reflection**: Route handlers are compiled at startup for maximum performance.

[**Architecture & Comparison with NestJS/Express**](./docs/COMPARISON.md) | [**Changelog**](./CHANGELOG.md)

## Installation

```bash
npm install hono-injector hono inversify reflect-metadata
```

## Quick Start

1. **Setup your container**

```typescript
import 'reflect-metadata';
import { Container } from 'inversify';
import { Hono } from 'hono';
import { registerControllers } from 'hono-injector';
// Import your controllers somewhere so decorators run!
import './controllers/UserController';

const container = new Container();
// bind your services...
// container.bind(UserService).toSelf();

const app = new Hono();
registerControllers(app, container);

export default app;
```

2. **Create a Controller**

```typescript
import { controller, httpGet, ctx } from 'hono-injector';
import { Context } from 'hono';
import { inject } from 'inversify';

@controller('/users')
export class UserController {
  constructor(@inject(UserService) private userService: UserService) {}

  @httpGet('/')
  getUsers(c: Context) {
    return c.json(this.userService.getAll());
  }

  @httpGet('/:id')
  getUser(@ctx() c: Context) {
    const id = c.req.param('id');
    return c.json(this.userService.getById(id));
  }
}
```

3. **Using Middleware**

You can apply middleware at the controller or method level.

```typescript
import { controller, httpPost, middleware } from 'hono-injector';
import { createMiddleware } from 'hono/factory';

// Example middleware
const logger = createMiddleware(async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

const auth = createMiddleware(async (c, next) => {
  // auth logic...
  await next();
});

// Apply to all routes in this controller
@controller('/orders', [logger])
export class OrderController {
  
  constructor(@inject(OrderService) private orderService: OrderService) {}

  // Apply specific middleware to this route
  @httpPost('/')
  @middleware(auth) 
  createOrder(c: Context) {
    return c.json({ message: 'Order created' });
  }
}
```

## Complex Scenarios

### Dependency Injection with Request Scope

All requests automatically get a **Child Container**. This means you can bind services in `inRequestScope()` to share state (like a user context or transaction) across services for a single request.

```typescript
// 1. Bind a Service in Request Scope
container.bind(UserContext).toSelf().inRequestScope();

// 2. Inject it anywhere
@injectable()
class OrderService {
  constructor(@inject(UserContext) private userCtx: UserContext) {}

  create() {
    // This userCtx is unique to the current request!
    console.log(this.userCtx.currentUser); 
  }
}
```

### Custom Parameter Decorators

You can easily create your own decorators using the Hono Context.

```typescript
import { createParamDecorator } from 'hono-injector';

// Create a decorator that extracts the user from c.get('user')
export const CurrentUser = () => {
    return (target, propertyKey, index) => {
        // Custom implementation...
        // See source code for 'createParamDecorator' usage
    };
};
```

## API

### Class Decorators
- `@controller(path, middleware?)`

### Method Decorators
- `@httpGet(path, middleware?)`
- `@httpPost(path, middleware?)`
- `@httpPut(path, middleware?)`
- `@httpDelete(path, middleware?)`
- `@httpPatch(path, middleware?)`

### Parameter Decorators
- `@ctx()` - Inject Hono Context
- `@body()` - Inject parsed body
- `@param(name)` - Inject path parameter
- `@query(name)` - Inject query parameter
- `@header(name)` - Inject header value

## License

MIT
