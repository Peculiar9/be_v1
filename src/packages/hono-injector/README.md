# Hono Injector

> Inversify + Hono = ⚡️

Decorator-based routing and dependency injection for [Hono](https://hono.dev/), heavily inspired by `inversify-express-utils`.

## Features

- 🏗 **Class-based Controllers**: Organize your routes using classes.
- 💉 **Dependency Injection**: Full support for InversifyJS.
- 🎨 **Decorators**: `@controller`, `@httpGet`, `@middleware`, and more.
- 🚀 **Lightweight**: Built on top of Hono's blazing fast router.

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
  
  // Apply specific middleware to this route
  @httpPost('/')
  @middleware(auth) 
  createOrder(c: Context) {
    return c.json({ message: 'Order created' });
  }
}
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
