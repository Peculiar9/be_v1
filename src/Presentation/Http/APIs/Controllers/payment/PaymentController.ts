import { Context } from 'hono';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpDelete, httpPut, ctx, body } from 'hono-injector';
import { TYPES } from '@Core/Types/Constants';
import { IPaymentService } from '@Core/Application/Interface/Services/IPaymentService';
import AuthMiddleware from '../../Middleware/AuthMiddleware';
import { BaseController } from '../BaseController';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';
import { IUser } from '@Core/Application/Interface/Entities/auth-and-user/IUser';

@controller(`/payment`)
export class PaymentController extends BaseController {
    constructor(
        @inject(TYPES.PaymentService) private paymentService: IPaymentService
    ) {
        super();
    }

    /**
     * Create a Stripe setup intent for securely collecting payment method details
     */
    @httpPost('/setup-intent', [AuthMiddleware.authenticate()])
    async createSetupIntent(@ctx() c: Context) {
        try {
            const user = c.get('user') as IUser;
            const userId = user._id as string;

            // Get user from database to ensure they have a Stripe customer ID
            // If not, one will be created in the service
            const setupIntent = await this.paymentService.createSetupIntent(userId);

            return this.success(c, {
                clientSecret: setupIntent.client_secret
            }, ResponseMessage.SETUP_INTENT_CREATED_SUCCESS);
        } catch (error: any) {
            console.error('Error creating setup intent:', error);
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Add a payment method to the user's account
     */
    @httpPost('/methods', [AuthMiddleware.authenticate()])
    async addPaymentMethod(@ctx() c: Context) {
        try {
            const { paymentMethodId, setAsDefault } = await c.req.json();
            const user = c.get('user') as IUser;
            const userId = user._id as string;

            const paymentMethod = await this.paymentService.addPaymentMethod(
                userId,
                paymentMethodId,
                setAsDefault
            );

            return this.success(c, paymentMethod, ResponseMessage.PAYMENT_METHOD_ADDED_SUCCESS);
        } catch (error: any) {
            console.error('Error adding payment method:', error);
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Get all payment methods for the current user
     */
    @httpGet('/methods', [AuthMiddleware.authenticate()])
    async getPaymentMethods(@ctx() c: Context) {
        try {
            const user = c.get('user') as IUser;
            const userId = user._id as string;
            const methods = await this.paymentService.getPaymentMethods(userId);

            return this.success(c, methods, ResponseMessage.PAYMENT_METHODS_RETRIEVED_SUCCESS);
        } catch (error: any) {
            console.error('Error getting payment methods:', error);
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Set a payment method as default
     */
    @httpPut('/methods/default', [AuthMiddleware.authenticate()])
    async setDefaultPaymentMethod(@ctx() c: Context) {
        try {
            const { paymentMethodId } = await c.req.json();
            const user = c.get('user') as IUser;
            const userId = user._id as string;

            await this.paymentService.setDefaultPaymentMethod(userId, paymentMethodId);

            return this.success(c, { success: true }, ResponseMessage.DEFAULT_PAYMENT_METHOD_SET_SUCCESS);
        } catch (error: any) {
            console.error('Error setting default payment method:', error);
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Remove a payment method
     */
    @httpDelete('/methods/:paymentMethodId', [AuthMiddleware.authenticate()])
    async removePaymentMethod(@ctx() c: Context) {
        try {
            const paymentMethodId = c.req.param('paymentMethodId');
            const user = c.get('user') as IUser;
            const userId = user._id as string;

            await this.paymentService.removePaymentMethod(userId, paymentMethodId);

            return this.success(c, { success: true }, ResponseMessage.PAYMENT_METHOD_REMOVED_SUCCESS);
        } catch (error: any) {
            console.error('Error removing payment method:', error);
            return this.error(c, error.message, error.statusCode);
        }
    }
}
