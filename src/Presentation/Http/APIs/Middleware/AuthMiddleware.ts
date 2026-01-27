import { Context, Next } from 'hono';
import { injectable, inject } from 'inversify';
import { TYPES } from '@Core/Types/Constants';
import { AuthenticationError, ForbiddenError } from '@Core/Application/Error/AppError';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';
import { DIContainer } from '@Core/DI/DIContainer';
import type { IUser } from '@Core/Application/Interface/Entities/auth-and-user/IUser';
import { UserRole } from '@Core/Application/Enums/UserRole';
import { AuthenticationService } from '@Infrastructure/Services/AuthenticationService';
import type { IAuthenticationService } from '@Core/Application/Interface/Services/IAuthenticationService';

@injectable()
export class AuthMiddleware {
  constructor(
    @inject(TYPES.AuthenticationService) private authenticationService: IAuthenticationService,
  ) { }

  public static authenticate() {
    const middleware = AuthMiddleware.createInstance();
    return async (c: Context, next: Next) => {
      await middleware.authenticateInstance(c, next);
    };
  }

  public static authenticateAdmin() {
    const middleware = AuthMiddleware.createInstance();
    return async (c: Context, next: Next) => {
      await middleware.authenticateOperatorInstance(c, next);
    };
  }

  public static authenticateOptional() {
    const middleware = AuthMiddleware.createInstance();
    return async (c: Context, next: Next) => {
      await middleware.authenticateOptionalInstance(c, next);
    };
  }

  private static createInstance(): AuthMiddleware {
    const container = DIContainer.getInstance();
    const authenticationService = container.get<AuthenticationService>(TYPES.AuthenticationService);
    return new AuthMiddleware(authenticationService);
  }

  private authenticateInstance = async (c: Context, next: Next) => {
    try {
      const token = this.extractToken(c);
      const user = await this.validateTokenAndUser(token);
      c.set('user', user);
      await next();
    } catch (error: any) {
      return this.handleAuthError(c, error);
    }
  };

  private authenticateOperatorInstance = async (c: Context, next: Next) => {
    try {
      const token = this.extractToken(c);
      if (token === 'undefined' || token === null || token === '' || !token) {
        throw new AuthenticationError(ResponseMessage.INVALID_TOKEN_MESSAGE);
      }
      const user = await this.validateTokenAndUser(token, UserRole.OPERATOR);
      console.log('user', user);
      c.set('user', user);
      await next();
    } catch (error: any) {
      return this.handleAuthError(c, error);
    }
  };

  private authenticateOptionalInstance = async (c: Context, next: Next) => {
    try {
      const token = this.extractTokenOptional(c);
      if (token) {
        const user = await this.validateTokenAndUser(token);
        c.set('user', user);
      }
      await next();
    } catch (error: any) {
      // Optionally log the error, but proceed as unauthenticated.
      console.log('Optional authentication failed:', error.message);
      await next();
    }
  };

  private extractToken(c: Context): string {
    const authHeader = c.req.header('Authorization');
    // console.log("Request Header: ", c.req.header()); // Debug if needed
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

  private async validateTokenAndUser(token: string, requiredRole?: UserRole) {
    // console.log("it got here validate token and user");
    const decodedToken = await this.authenticationService.verifyToken(token);
    const user: IUser = await this.authenticationService.validateUser(decodedToken.sub as string);
    // console.log('decodedToken from auth middleware', decodedToken)
    // console.log('user from auth middleware', user);
    if (requiredRole && !user?.roles?.includes(requiredRole)) {
      throw new ForbiddenError(ResponseMessage.INSUFFICIENT_PRIVILEDGES_MESSAGE);
    }
    return user;
  }

  private handleAuthError(c: Context, error: any) {
    const statusCode = error instanceof AuthenticationError ? 401 :
      error instanceof ForbiddenError ? 403 : 500;

    return c.json({
      success: false,
      message: error.message || ResponseMessage.INTERNAL_SERVER_ERROR_MESSAGE,
      error_code: error.errorCode || 0,
    }, statusCode);
  }
}

export default AuthMiddleware;

