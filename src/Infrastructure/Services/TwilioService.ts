import { inject, injectable } from 'inversify';
import { TYPES } from '@Core/Types/Constants';
import type {
    ITwilioService,
    TwilioMessageOptions,
    TwilioMessageResponse,
    TwilioVerificationOptions
} from '@Core/Application/Interface/Services/ITwilioService';
import { ServiceError, ValidationError } from '@Core/Application/Error/AppError';
import { Console, LogLevel } from '../Utils/Console';

import { Twilio as twilio } from 'twilio';

/**
 * Twilio service implementation for SMS, WhatsApp, and verification
 */
@injectable()
export class TwilioService implements ITwilioService {
    private readonly client: any;
    private readonly verifyClient: any;

    constructor(
        @inject(TYPES.TWILIO_ACCOUNT_SID) private readonly accountSid: string,
        @inject(TYPES.TWILIO_AUTH_TOKEN) private readonly authToken: string,
        @inject(TYPES.TWILIO_VERIFY_SERVICE_SID) private readonly verifyServiceSid: string,
        @inject(TYPES.TWILIO_PHONE_NUMBER) private readonly defaultPhoneNumber: string,
        @inject(TYPES.TWILIO_WHATSAPP_NUMBER) private readonly defaultWhatsAppNumber: string
    ) {
        // Initialize Twilio client
        this.client = new twilio(this.accountSid, this.authToken);
        this.verifyClient = this.client.verify.v2.services(this.verifyServiceSid);

    }

    /**
     * Send an SMS message
     * @param to Phone number in E.164 format
     * @param body Message content
     * @param options Additional options
     */
    async sendSMS(to: string, body: string, options?: TwilioMessageOptions): Promise<TwilioMessageResponse> {
        try {
            const messageOptions = {
                to,
                body,
                from: options?.from || this.defaultPhoneNumber,
                statusCallback: options?.statusCallback,
                messagingServiceSid: options?.messagingServiceSid
            };

            const message = await this.client.messages.create(messageOptions);

            return {
                sid: message.sid,
                status: message.status,
                dateCreated: new Date(message.dateCreated),
                dateUpdated: new Date(message.dateUpdated),
                to: message.to,
                from: message.from,
                body: message.body,
                success: true
            };
        } catch (error: any) {
            Console.write('Failed to send SMS', LogLevel.ERROR, { to, error: error.message });

            return {
                sid: '',
                status: 'failed',
                dateCreated: new Date(),
                dateUpdated: new Date(),
                to,
                from: options?.from || this.defaultPhoneNumber,
                body,
                errorCode: error.code,
                errorMessage: error.message,
                success: false
            };
        }
    }

    /**
     * Send a WhatsApp message
     * @param to Phone number in E.164 format
     * @param body Message content
     * @param options Additional options
     */
    async sendWhatsApp(to: string, body: string, options?: TwilioMessageOptions): Promise<TwilioMessageResponse> {
        try {
            // Format WhatsApp number with whatsapp: prefix
            const from = `whatsapp:${options?.from || this.defaultWhatsAppNumber}`;
            const formattedTo = `whatsapp:${to}`;

            const messageOptions = {
                to: formattedTo,
                body,
                from,
                statusCallback: options?.statusCallback
            };

            const message = await this.client.messages.create(messageOptions);

            return {
                sid: message.sid,
                status: message.status,
                dateCreated: new Date(message.dateCreated),
                dateUpdated: new Date(message.dateUpdated),
                to: message.to,
                from: message.from,
                body: message.body,
                success: true
            };
        } catch (error: any) {
            Console.write('Failed to send WhatsApp message', LogLevel.ERROR, { to, error: error.message });

            return {
                sid: '',
                status: 'failed',
                dateCreated: new Date(),
                dateUpdated: new Date(),
                to: `whatsapp:${to}`,
                from: `whatsapp:${options?.from || this.defaultWhatsAppNumber}`,
                body,
                errorCode: error.code,
                errorMessage: error.message,
                success: false
            };
        }
    }

    /**
     * Start verification process by sending an OTP
     * @param to Phone number in E.164 format
     * @param options Verification options
     */
    async startVerification(to: string, options: TwilioVerificationOptions): Promise<{
        sid: string;
        status: string;
        to: string;
        valid: boolean;
        channel: string;
    }> {
        try {
            if (!this.verifyServiceSid) {
                throw new ValidationError('Twilio Verify Service SID is not configured');
            }

            const verification = await this.verifyClient.verifications.create({
                to,
                channel: options.channel,
                locale: options.locale
            });

            return {
                sid: verification.sid,
                status: verification.status,
                to: verification.to,
                valid: verification.status === 'pending',
                channel: verification.channel
            };
        } catch (error: any) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ServiceError(`Failed to start verification: ${error.message}`);
        }
    }

    /**
     * Check verification code
     * @param to Phone number in E.164 format
     * @param code Verification code
     */
    async checkVerification(to: string, code: string): Promise<{
        sid: string;
        status: string;
        valid: boolean;
    }> {
        try {
            if (!this.verifyServiceSid) {
                throw new ValidationError('Twilio Verify Service SID is not configured');
            }

            const verification = await this.verifyClient.verificationChecks.create({
                to,
                code
            });

            return {
                sid: verification.sid,
                status: verification.status,
                valid: verification.status === 'approved'
            };
        } catch (error: any) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ServiceError(`Failed to check verification: ${error.message}`);
        }
    }
}
