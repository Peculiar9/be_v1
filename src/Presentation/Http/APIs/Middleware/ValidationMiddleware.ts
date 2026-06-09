import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type { Context, Next } from 'hono';
import { ResponseHelper } from '@Core/Application/Response/ResponseHelper';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';

type ValidationErrorDetail = {
  field: string;
  messages: string[];
  constraints: Record<string, string>;
};

function formatValidationErrors(errors: ValidationError[], parentPath = ''): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const constraints = error.constraints ?? {};
    const current = Object.keys(constraints).length > 0
      ? [{
          field,
          messages: Object.values(constraints),
          constraints,
        }]
      : [];

    const children = error.children?.length
      ? formatValidationErrors(error.children, field)
      : [];

    return [...current, ...children];
  });
}

export function validationMiddleware<T extends object>(dtoClass: ClassConstructor<T>) {
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
          success: false,
          message: ResponseMessage.VALIDATION_ERROR_MESSAGE,
          error_code: 100,
          data: {
            errors: formatValidationErrors(errors),
          },
        }, 400);
      }

      // Pass the validated object to the controller via context
      c.set('validated_body', dtoObject);
      await next();
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return ResponseHelper.errorMessage(c, 'Invalid JSON body', 400, 100);
      }

      return ResponseHelper.error(c, error, 'Internal server error during validation');
    }
  };
}
