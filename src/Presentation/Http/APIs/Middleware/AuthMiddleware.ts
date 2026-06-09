import type { Context, Next } from 'hono';
import { injectable, inject } from 'inversify';
import { TYPES } from '@Core/Types/Constants';
import { AuthenticationError, ForbiddenError } from '@Core/Application/Error/AppError';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';
import { DIContainer } from '@Core/DI/DIContainer';
import type { IUser } from '@Core/Application/Interface/Entities/auth-and-user/IUser';
import { UserRole } from '@Core/Application/Enums/UserRole';
import type { IAuthenticationService } from '@Core/Application/Interface/Services/IAuthenticationService';
import { ResponseHelper } from '@Core/Application/Response/ResponseHelper';
import {
  Permission,
  hasAnyPermission,
  hasPermission,
  hasRole,
} from '@Core/Application/Permissions/Permissions';

interface TokenPayload {
  sub?: string;
}

type AuthenticatedHandler = (middleware: AuthMiddleware, c: Context, next: Next) => Promise<void>;

@injectable()
export class AuthMiddleware {
  constructor(
    @inject(TYPES.AuthenticationService) private authenticationService: IAuthenticationService,
  ) { }

  public static authenticate() {
    return AuthMiddleware.createHandler(async (middleware, c, next) => {
      const token = middleware.extractToken(c);
      const user = await middleware.validateTokenAndUser(token);
      c.set('user', user);
      await next();
    });
  }

  public static authenticateOptional() {
    const middleware = AuthMiddleware.createInstance();
    return async (c: Context, next: Next) => {
      const token = middleware.extractTokenOptional(c);
      if (token) {
        try {
          const user = await middleware.validateTokenAndUser(token);
          c.set('user', user);
        } catch {
          c.set('user', undefined);
        }
      }
      await next();
    };
  }

  public static authenticateRoles(...roles: UserRole[]) {
    return AuthMiddleware.createHandler(async (middleware, c, next) => {
      const token = middleware.extractToken(c);
      const user = await middleware.validateTokenAndUser(token);
      middleware.ensureRoles(user, roles);
      c.set('user', user);
      await next();
    });
  }

  public static authenticateAdmin() {
    return AuthMiddleware.authenticateRoles(UserRole.ADMIN);
  }

  public static requirePermission(permission: Permission) {
    return AuthMiddleware.createHandler(async (middleware, c, next) => {
      const token = middleware.extractToken(c);
      const user = await middleware.validateTokenAndUser(token);
      middleware.ensurePermission(user, permission);
      c.set('user', user);
      await next();
    });
  }

  public static requireAnyPermission(...permissions: Permission[]) {
    return AuthMiddleware.createHandler(async (middleware, c, next) => {
      const token = middleware.extractToken(c);
      const user = await middleware.validateTokenAndUser(token);
      middleware.ensureAnyPermission(user, permissions);
      c.set('user', user);
      await next();
    });
  }

  public static initializeContext() {
    return async (c: Context, next: Next) => {
      const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      const userAgent = c.req.header('user-agent') || 'unknown';
      const { RequestContext } = await import('@Infrastructure/Context/RequestContext');

      return RequestContext.run({ ipAddress, userAgent }, async () => {
        return await next();
      });
    };
  }

  private static createHandler(handler: AuthenticatedHandler) {
    const middleware = AuthMiddleware.createInstance();
    return async (c: Context, next: Next) => {
      try {
        await handler(middleware, c, next);
      } catch (error) {
        return ResponseHelper.error(c, error);
      }
    };
  }

  private static createInstance(): AuthMiddleware {
    const container = DIContainer.getInstance();
    const authenticationService = container.get<IAuthenticationService>(TYPES.AuthenticationService);
    return new AuthMiddleware(authenticationService);
  }

  private extractToken(c: Context): string {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      throw new AuthenticationError(ResponseMessage.INVALID_AUTH_HEADER_MESSAGE);
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new AuthenticationError(ResponseMessage.INVALID_AUTH_HEADER_MESSAGE);
    }

    return token;
  }

  private extractTokenOptional(c: Context): string | null {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return null;
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      return null;
    }
    return token;
  }

  private async validateTokenAndUser(token: string): Promise<IUser> {
    const decodedToken = await this.authenticationService.verifyToken(token) as TokenPayload;
    if (!decodedToken.sub) {
      throw new AuthenticationError(ResponseMessage.INVALID_TOKEN_PAYLOAD_MESSAGE);
    }

    return await this.authenticationService.validateUser(decodedToken.sub);
  }

  private ensureRoles(user: IUser, requiredRoles: UserRole[]): void {
    if (!hasRole(this.getUserRoles(user), requiredRoles)) {
      throw new ForbiddenError(ResponseMessage.INSUFFICIENT_PRIVILEDGES_MESSAGE);
    }
  }

  private ensurePermission(user: IUser, permission: Permission): void {
    if (!hasPermission(this.getUserRoles(user), permission)) {
      throw new ForbiddenError(ResponseMessage.INSUFFICIENT_PRIVILEDGES_MESSAGE);
    }
  }

  private ensureAnyPermission(user: IUser, permissions: Permission[]): void {
    if (!hasAnyPermission(this.getUserRoles(user), permissions)) {
      throw new ForbiddenError(ResponseMessage.INSUFFICIENT_PRIVILEDGES_MESSAGE);
    }
  }

  private getUserRoles(user: IUser): string[] {
    return (user.roles ?? []).map(role => String(role));
  }
}

export default AuthMiddleware;
