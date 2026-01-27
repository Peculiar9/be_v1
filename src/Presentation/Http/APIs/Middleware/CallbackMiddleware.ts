import { Context, Next } from 'hono';
import { injectable } from 'inversify';

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
                    resolve(c.json({
                        status: 'success',
                        message: 'Webhook received and being processed'
                    }, 200));
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
                const signature = c.req.header('x-webhook-signature') || c.req.header('stripe-signature');

                // If no signature is required or signature is valid
                if (!secret || !signature) {
                    await next();
                    return;
                }

                // Ensure we have the raw body text for verification
                // Hono caches this so subsequent c.req.json() calls work fine
                const body = await c.req.text();

                // TODO: Implement signature validation logic here
                // This will depend on the specific webhook provider's signature format
                // Example:
                // const computedSignature = crypto
                //     .createHmac('sha256', secret)
                //     .update(body)
                //     .digest('hex');

                // if (signature !== computedSignature) {
                //     throw new Error('Invalid webhook signature');
                // }

                await next();
            } catch (error: any) {
                return c.json({ error: error.message }, 400);
            }
        };
    }
}
