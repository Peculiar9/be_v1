import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../Error/AppError";
import { ResponseMessage } from "./ResponseFormat";

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  error_code: number;
  data: null;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

const VALID_HTTP_STATUS_CODES = new Set<number>([
  200, 201, 202,
  400, 401, 403, 404, 409, 422, 429,
  500, 502, 503, 504,
]);

export function toStatusCode(status: number | undefined, fallback: ContentfulStatusCode): ContentfulStatusCode {
  if (status && VALID_HTTP_STATUS_CODES.has(status)) {
    return status as ContentfulStatusCode;
  }
  return fallback;
}

export function successEnvelope<T>(data: T, message = ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE): SuccessEnvelope<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function errorEnvelope(message: string, errorCode = 9999): ErrorEnvelope {
  return {
    success: false,
    message,
    error_code: errorCode,
    data: null,
  };
}

export function errorDetails(error: unknown, fallbackMessage = ResponseMessage.INTERNAL_SERVER_ERROR_MESSAGE) {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: toStatusCode(error.statusCode, 500),
      errorCode: error.errorCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      statusCode: 500 as ContentfulStatusCode,
      errorCode: 9999,
    };
  }

  return {
    message: fallbackMessage,
    statusCode: 500 as ContentfulStatusCode,
    errorCode: 9999,
  };
}

export class ResponseHelper {
  static success<T>(c: Context, data: T, message?: string, status: ContentfulStatusCode = 200) {
    return c.json(successEnvelope(data, message), status);
  }

  static created<T>(c: Context, data: T, message?: string) {
    return c.json(successEnvelope(data, message), 201);
  }

  static error(c: Context, error: unknown, fallbackMessage?: string, fallbackStatus: ContentfulStatusCode = 500) {
    const details = errorDetails(error, fallbackMessage);
    const statusCode = error instanceof AppError ? details.statusCode : fallbackStatus;
    return c.json(errorEnvelope(details.message, details.errorCode), statusCode);
  }

  static errorMessage(c: Context, message: string, status: ContentfulStatusCode, errorCode = 9999) {
    return c.json(errorEnvelope(message, errorCode), status);
  }
}
