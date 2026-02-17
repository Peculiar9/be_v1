import { injectable, inject } from 'inversify';
import Stripe from 'stripe';
import { TYPES } from '@Core/Types/Constants';
import { IPaymentService, PaymentMethod, CreatePaymentIntentParams, CapturePaymentParams, RefundParams } from '@Core/Application/Interface/Services/IPaymentService';
import { PaymentTransaction, PaymentTransactionStatus, PaymentTransactionType } from '@Core/Types/PaymentTransaction';
import { UserRepository } from '../../Repository/SQL/users/UserRepository';
import { PaymentTransactionRepository } from '../../Repository/SQL/auth/PaymentTransactionRepository';
import { UtilityService } from '@Core/Services/UtilityService';
import { AuthorizationError, ValidationError } from '@Core/Application/Error/AppError';
import { BaseService } from '../base/BaseService';
import { TransactionManager } from 'peculiar-orm';

/**
 * Implementation of the Payment Service using Stripe
 */
@injectable()
export class StripePaymentService extends BaseService implements IPaymentService {
    private readonly stripe: Stripe;
    private readonly defaultCurrency: string = 'usd';
    private readonly preAuthAmount: number = 2000; // $20.00 default pre-auth amount in cents

    constructor(
        @inject(TYPES.TransactionManager) protected readonly transactionManager: TransactionManager,
        @inject(TYPES.UserRepository) private readonly userRepository: UserRepository,
        @inject(TYPES.PaymentTransactionRepository) private readonly paymentTransactionRepository: PaymentTransactionRepository,
        @inject(TYPES.STRIPE_SECRET_KEY) private readonly stripeSecretKey: string,
        @inject(TYPES.STRIPE_PRE_AUTH_AMOUNT) private readonly configuredPreAuthAmount?: number
    ) {
        super(transactionManager);
        this.stripe = new Stripe(this.stripeSecretKey, {
            apiVersion: '2025-08-27.basil',
        });

        if (this.configuredPreAuthAmount) {
            console.debug(`Pre-auth amount set to ${this.configuredPreAuthAmount}`);
            this.preAuthAmount = this.configuredPreAuthAmount;
        }
    }

    async createSetupIntent(userId: string): Promise<{ id: string; client_secret: string }> {
        let transactionSuccessfullyStarted = false;

        try {
            await this.transactionManager.beginTransaction();
            transactionSuccessfullyStarted = true;

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new ValidationError(`User with ID ${userId} not found`);
            }

            if (!user.stripe_id) {
                const customerName = user.first_name && user.last_name ?
                    `${user.first_name} ${user.last_name}` : 'Customer';

                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: customerName,
                    metadata: { userId }
                });

                await this.userRepository.update(userId, { stripe_id: customer.id });
                user.stripe_id = customer.id;
            }

            const setupIntent = await this.stripe.setupIntents.create({
                customer: user.stripe_id,
                payment_method_types: ['card'],
                usage: 'off_session',
                metadata: { userId }
            });

            await this.transactionManager.commit();

            return {
                id: setupIntent.id,
                client_secret: setupIntent.client_secret as string
            };
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.transactionManager.rollback(); } catch (_) {}
            }
            throw new Error(`Failed to create setup intent: ${error.message}`);
        }
    }

    async createCustomer(userId: string, email: string, name: string): Promise<string> {
        let transactionSuccessfullyStarted = false;

        try {
            await this.transactionManager.beginTransaction();
            transactionSuccessfullyStarted = true;

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            if (user.stripe_id) {
                await this.transactionManager.commit();
                return user.stripe_id;
            }

            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata: { userId }
            });

            await this.userRepository.update(userId, { stripe_id: customer.id });
            await this.transactionManager.commit();

            return customer.id;
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.transactionManager.rollback(); } catch (_) {}
            }
            throw new Error(`Failed to create payment customer: ${error.message}`);
        }
    }

    async addPaymentMethod(userId: string, paymentMethodToken: string, setAsDefault: boolean = true): Promise<PaymentMethod> {
        let transactionSuccessfullyStarted = false;

        try {
            await this.transactionManager.beginTransaction();
            transactionSuccessfullyStarted = true;

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            if (!user.stripe_id) {
                throw new Error(`User ${userId} does not have a Stripe customer ID`);
            }

            const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodToken);

            await this.stripe.paymentMethods.attach(paymentMethodToken, {
                customer: user.stripe_id
            });

            if (setAsDefault) {
                await this.stripe.customers.update(user.stripe_id, {
                    invoice_settings: { default_payment_method: paymentMethodToken }
                });
            }

            const card = paymentMethod.card;
            const paymentMethodData: PaymentMethod = {
                id: paymentMethod.id,
                type: paymentMethod.type,
                brand: card?.brand,
                last4: card?.last4,
                expMonth: card?.exp_month,
                expYear: card?.exp_year,
                isDefault: setAsDefault
            };

            const cardTokens = user.card_tokens || [];
            const updatedCardTokens = cardTokens.filter((token: any) => token.id !== paymentMethodData.id);
            updatedCardTokens.push(paymentMethodData);

            await this.userRepository.update(userId, { card_tokens: updatedCardTokens });
            await this.transactionManager.commit();

            return paymentMethodData;
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.transactionManager.rollback(); } catch (_) {}
            }
            throw new Error(`Failed to add payment method: ${error.message}`);
        }
    }

    async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AuthorizationError(`User with ID ${userId} not found`);
            }

            if (!user.stripe_id) {
                return [];
            }

            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: user.stripe_id,
                type: 'card'
            });

            const customer = await this.stripe.customers.retrieve(user.stripe_id);
            const defaultPaymentMethodId =
                typeof customer !== 'string' &&
                !('deleted' in customer) &&
                customer.invoice_settings?.default_payment_method;

            return paymentMethods.data.map((pm: any) => {
                const card = pm.card;
                return {
                    id: pm.id,
                    type: pm.type,
                    brand: card?.brand,
                    last4: card?.last4,
                    expMonth: card?.exp_month,
                    expYear: card?.exp_year,
                    isDefault: pm.id === defaultPaymentMethodId
                };
            });
        } catch (error: any) {
            throw new Error(`Failed to get payment methods: ${error.message}`);
        }
    }

    async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            if (!user.stripe_id) {
                throw new Error(`User ${userId} does not have a Stripe customer ID`);
            }

            await this.stripe.customers.update(user.stripe_id, {
                invoice_settings: { default_payment_method: paymentMethodId }
            });

            if (user.card_tokens && user.card_tokens.length > 0) {
                const updatedCardTokens = user.card_tokens.map((token: any) => ({
                    ...token,
                    isDefault: token.id === paymentMethodId
                }));
                await this.userRepository.update(userId, { card_tokens: updatedCardTokens });
            }

            await this.commitTransaction();
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to set default payment method: ${error.message}`);
        }
    }

    async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            if (!user.stripe_id) {
                throw new Error(`User ${userId} does not have a Stripe customer ID`);
            }

            const customer = await this.stripe.customers.retrieve(user.stripe_id);
            const isDefault = typeof customer !== 'string' &&
                !('deleted' in customer) &&
                customer.invoice_settings?.default_payment_method === paymentMethodId;

            await this.stripe.paymentMethods.detach(paymentMethodId);

            if (user.card_tokens && user.card_tokens.length > 0) {
                const updatedCardTokens = user.card_tokens.filter((token: any) => token.id !== paymentMethodId);

                if (isDefault && updatedCardTokens.length > 0) {
                    const newDefaultId = updatedCardTokens[0].id;
                    updatedCardTokens[0].isDefault = true;
                    await this.stripe.customers.update(user.stripe_id, {
                        invoice_settings: { default_payment_method: newDefaultId }
                    });
                }

                await this.userRepository.update(userId, { card_tokens: updatedCardTokens });
            }

            await this.commitTransaction();
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to remove payment method: ${error.message}`);
        }
    }

    async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentTransaction> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const user = await this.userRepository.findById(params.userId);
            if (!user) {
                throw new Error(`User with ID ${params.userId} not found`);
            }

            if (!user.stripe_id) {
                throw new Error(`User ${params.userId} does not have a Stripe customer ID`);
            }

            const amount = params.type === PaymentTransactionType.PRE_AUTHORIZATION
                ? this.preAuthAmount
                : params.amount;

            const paymentIntent = await this.stripe.paymentIntents.create({
                amount,
                currency: params.currency.toLowerCase(),
                customer: user.stripe_id,
                capture_method: 'manual',
                confirm: true,
                metadata: {
                    userId: params.userId,
                    sessionId: params.sessionId,
                    type: params.type,
                    ...params.metadata
                }
            });

            const transaction: PaymentTransaction = {
                user_id: params.userId,
                session_id: params.sessionId,
                amount,
                currency: params.currency,
                status: PaymentTransactionStatus.PENDING,
                type: params.type,
                provider: 'stripe',
                provider_transaction_id: paymentIntent.id,
                payment_intent_id: paymentIntent.id,
                payment_method_id: paymentIntent.payment_method as string,
                metadata: params.metadata,
                created_at: new Date(),
                updated_at: new Date()
            };

            await this.paymentTransactionRepository.create(transaction);
            await this.commitTransaction();

            return transaction;
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to create payment intent: ${error.message}`);
        }
    }

    async capturePayment(params: CapturePaymentParams): Promise<PaymentTransaction> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const transaction = await this.paymentTransactionRepository.findByPaymentIntentId(params.paymentIntentId);
            if (!transaction) {
                throw new Error(`Transaction with payment intent ID ${params.paymentIntentId} not found`);
            }

            await this.stripe.paymentIntents.capture(params.paymentIntentId, {
                amount_to_capture: params.amount,
                metadata: params.metadata
            });

            const updatedTransaction: Partial<PaymentTransaction> = {
                amount: params.amount,
                status: PaymentTransactionStatus.SUCCEEDED,
                provider_transaction_id: UtilityService.generateUUID(),
                updated_at: new Date(),
                metadata: {
                    ...transaction.metadata,
                    ...params.metadata
                }
            };

            await this.paymentTransactionRepository.update(transaction._id as string, updatedTransaction);
            await this.commitTransaction();

            return { ...transaction, ...updatedTransaction } as PaymentTransaction;
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to capture payment: ${error.message}`);
        }
    }

    async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const transaction = await this.paymentTransactionRepository.findByPaymentIntentId(paymentIntentId);
            if (!transaction) {
                throw new Error(`Transaction with payment intent ID ${paymentIntentId} not found`);
            }

            await this.stripe.paymentIntents.cancel(paymentIntentId);

            await this.paymentTransactionRepository.update(transaction._id as string, {
                status: PaymentTransactionStatus.FAILED,
                failure_reason: 'Cancelled by system',
                updated_at: new Date()
            });

            await this.commitTransaction();
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to cancel payment intent: ${error.message}`);
        }
    }

    async processRefund(params: RefundParams): Promise<PaymentTransaction> {
        let transactionSuccessfullyStarted = false;

        try {
            transactionSuccessfullyStarted = await this.beginTransaction();

            const originalTransaction = await this.paymentTransactionRepository.findById(params.transactionId);
            if (!originalTransaction) {
                throw new Error(`Transaction with ID ${params.transactionId} not found`);
            }

            if (originalTransaction.status !== PaymentTransactionStatus.SUCCEEDED) {
                throw new Error(`Cannot refund transaction ${params.transactionId} with status ${originalTransaction.status}`);
            }

            if (!originalTransaction.provider_transaction_id) {
                throw new Error(`Transaction ${params.transactionId} has no provider transaction ID`);
            }

            const refund = await this.stripe.refunds.create({
                charge: originalTransaction.provider_transaction_id,
                amount: params.amount,
                reason: params.reason as Stripe.RefundCreateParams.Reason
            });

            const refundTransaction: PaymentTransaction = {
                user_id: originalTransaction.user_id,
                session_id: originalTransaction.session_id,
                amount: params.amount || originalTransaction.amount,
                currency: originalTransaction.currency,
                status: PaymentTransactionStatus.SUCCEEDED,
                type: PaymentTransactionType.REFUND,
                provider: 'stripe',
                provider_transaction_id: refund.id,
                payment_intent_id: originalTransaction.payment_intent_id,
                payment_method_id: originalTransaction.payment_method_id,
                metadata: {
                    original_transaction_id: originalTransaction._id as string,
                    reason: params.reason
                },
                created_at: new Date(),
                updated_at: new Date()
            };

            await this.paymentTransactionRepository.create(refundTransaction);

            await this.paymentTransactionRepository.update(originalTransaction._id as string, {
                status: PaymentTransactionStatus.REFUNDED,
                updated_at: new Date(),
                metadata: {
                    ...originalTransaction.metadata,
                    refunded: true,
                    refund_id: refundTransaction._id as string
                }
            });

            await this.commitTransaction();

            return refundTransaction;
        } catch (error: any) {
            if (transactionSuccessfullyStarted) {
                try { await this.rollbackTransaction(); } catch (_) {}
            }
            throw new Error(`Failed to process refund: ${error.message}`);
        }
    }

    async getTransaction(transactionId: string): Promise<PaymentTransaction> {
        try {
            const transaction = await this.paymentTransactionRepository.findById(transactionId);
            if (!transaction) {
                throw new Error(`Transaction with ID ${transactionId} not found`);
            }
            return transaction;
        } catch (error: any) {
            throw new Error(`Failed to get transaction: ${error.message}`);
        }
    }
}
