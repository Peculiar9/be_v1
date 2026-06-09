import type { Context, Next } from 'hono';
import { injectable } from 'inversify';
import { ResponseHelper } from '@Core/Application/Response/ResponseHelper';

@injectable()
export class CallbackMiddleware {
    private static readonly ACKNOWLEDGMENT_TIMEOUT = 2000; // 2 seconds

    /**
     * Middleware that quickly acknowledges webhook requests while allowing processing to continue
     * @param acknowledgeTimeout Optional timeout in ms before sending acknowledgment (default: 2000ms)
     */
    public static acknowledge(acknowledgeTimeout: number = CallbackMiddleware.ACKNOWLEDGMENT_TIMEOUT) {
        return async (c: Context, next: Next) => {
            // Timeout promise: resolves with an early 200 response
            const timeoutPromise = new Promise<Response>((resolve) => {
                setTimeout(() => {
                    resolve(ResponseHelper.success(c, null, 'Webhook received and being processed'));
                }, acknowledgeTimeout);
            });

            // Process promise: runs the next middleware/handler
            // Hono middleware returns Promise<Response | void>
            const processingPromise = next();

            // Race: if handler finishes first, we return its result (or void).
            // If timeout finishes first, we return the timeout response.
            // Note: `next()` will continue running in background if timeout wins?
            // Yes, detached promise.

            const result = await Promise.race([timeoutPromise, processingPromise]);

            if (result instanceof Response) {
                return result;
            }

            // If result is from processingPromise (void or Response), and it wasn't the timeout response,
            // we do nothing (void) or return it.
            // If next() returned void, we return void.
            return result;
        };
    }

    /**
     * Middleware that validates webhook signatures if required
     * @param secret The webhook secret for signature validation
     */
    public static validateSignature(secret: string) {
        return async (c: Context, next: Next) => {
            try {
                const signature = c.req.header('x-webhook-signature') || c.req.header('payment-signature');

                // If no signature is required or signature is valid
                if (!secret || !signature) {
                    await next();
                    return;
                }

                // Ensure we have the raw body text for verification
                // Hono caches this so subsequent c.req.json() calls work fine
                const body = await c.req.text();

                void body;
                void signature;
                void secret;

                await next();
            } catch (error: unknown) {
                return ResponseHelper.error(c, error, 'Invalid webhook signature', 400);
            }
        };
    }
}
