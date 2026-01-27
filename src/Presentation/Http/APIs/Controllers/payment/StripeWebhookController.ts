import type { Context } from 'hono';
import { inject } from 'inversify';
import { controller, httpPost, ctx } from 'hono-injector';
import { TYPES } from '@Core/Types/Constants';
import { BaseController } from '../BaseController';
import { CallbackMiddleware } from '../../Middleware/CallbackMiddleware';
import type { IStripeWebhookService } from '@Core/Application/Interface/Services/IStripeWebhookService';
import { Console } from '@Infrastructure/Utils/Console';
import Stripe from 'stripe';

/**
 * Controller for handling Stripe webhook events
 * This controller receives webhook events from Stripe and processes them asynchronously
 */
@controller(`/webhooks/stripe`)
export class StripeWebhookController extends BaseController {
    constructor(
        @inject(TYPES.StripeWebhookService) private stripeWebhookService: IStripeWebhookService
    ) {
        super();
    }

    /**
     * Handles incoming Stripe webhook events
     * Uses CallbackMiddleware.acknowledge to quickly respond to Stripe while processing continues
     * Uses CallbackMiddleware.validateSignature to verify the webhook signature
     */
    @httpPost('/', [
        CallbackMiddleware.validateSignature(process.env.STRIPE_WEBHOOK_SECRET || ''),
        CallbackMiddleware.acknowledge(1000)
    ])
    async handleWebhook(@ctx() c: Context) {
        try {
            // Hono caches the body allowing middleware to read text and us to read JSON
            const event = await c.req.json() as Stripe.Event;

            // Log the incoming webhook event
            Console.info('Received Stripe webhook event', {
                type: event.type,
                id: event.id,
                created: new Date(event.created * 1000).toISOString()
            });

            // Process the event asynchronously
            await this.stripeWebhookService.processWebhookEvent(event);

            // Return success response independently of middleware (middleware will use it if needed)
            return this.success(c, { received: true }, 'Webhook received successfully');
        } catch (error: any) {
            Console.error(error, {
                message: `StripeWebhookController::handleWebhook - ${error.message}`,
                webhook: (await c.req.json())?.id || 'unknown'
            });

            return this.error(c, error.message, error.statusCode || 500);
        }
    }
}
