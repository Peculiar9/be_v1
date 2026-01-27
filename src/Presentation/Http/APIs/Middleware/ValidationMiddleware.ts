import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type { Context, Next } from 'hono';

export function validationMiddleware(dtoClass: any) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const dtoObject = plainToInstance(dtoClass, body, {
        enableImplicitConversion: true,
      });

      // Validate the DTO instance
      const errors: ValidationError[] = await validate(dtoObject, {
        whitelist: true,              // Remove properties that do not have decorators
        forbidNonWhitelisted: true,   // Throw an error when non-whitelisted properties are provided
      });

      if (errors.length > 0) {
        return c.json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(error => ({
            property: error.property,
            constraints: error.constraints,
          }))
        }, 400);
      }

      // Pass the validated object to the controller via context
      c.set('validated_body', dtoObject);
      await next();
    } catch (error: any) {
      console.error('Validation middleware error:', error);

      // If JSON parsing fails it might throw syntax error
      if (error instanceof SyntaxError) {
        return c.json({
          status: 'error',
          message: 'Invalid JSON body'
        }, 400);
      }

      return c.json({
        status: 'error',
        message: 'Internal server error during validation'
      }, 500);
    }
  };
}