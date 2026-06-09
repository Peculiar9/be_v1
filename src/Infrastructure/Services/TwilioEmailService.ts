import { injectable } from 'inversify';
import { APP_NAME } from '@Core/Types/Constants';
import {
    ITwilioEmailService,
    EmailVerificationResult,
    SendEmailOptions
} from '@Core/Application/Interface/Services/ITwilioEmailService';
import { AppError, ValidationError, ServiceError } from '@Core/Application/Error/AppError';
import CryptoService from '@Core/Services/CryptoService';
import sgMail from '@sendgrid/mail';

/**
 * Twilio SendGrid email service implementation
 */
@injectable()
export class TwilioEmailService implements ITwilioEmailService {
    private readonly verificationTokens: Map<string, { token: string; expiresAt: Date }> = new Map();
    private apiKey: string;
    private fromEmail: string;

    constructor() {
        this.apiKey = process.env.SENDGRID_API_KEY || '';
        this.fromEmail = `noreply@${APP_NAME}.com`;

        if (this.apiKey) {
            sgMail.setApiKey(this.apiKey);
        }
    }

    /**
     * Send email verification using Twilio SendGrid Dynamic Template
     */
    async sendEmailVerification(
        email: string,
        firstName: string
    ): Promise<EmailVerificationResult> {
        try {
            if (!this.apiKey) {
                return {
                    success: false,
                    messageId: '',
                    verificationToken: '',
                    expiresAt: new Date(),
                    error: 'Email service not configured (missing SENDGRID_API_KEY)'
                };
            }

            if (!email || !firstName) {
                throw new ValidationError('Email and first name are required');
            }

            // Generate verification token
            const verificationToken = CryptoService.generateRandomString(32);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Store token temporarily (in production, use Redis or database)
            this.verificationTokens.set(email, {
                token: verificationToken,
                expiresAt
            });

            // Generate 6-digit verification code
            const verificationCode = verificationToken.substring(0, 6).toUpperCase();

            // Create verification URL
            const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

            // Dynamic template data for SendGrid template (only first_name as specified)
            const dynamicTemplateData = {
                first_name: firstName,
                verification_url: verificationUrl,
                verification_code: verificationCode,
                expires_in: '24 hours',
                current_year: new Date().getFullYear().toString()
            };

            // Send email using SendGrid dynamic template
            const msg = {
                to: email,
                from: {
                    email: this.fromEmail,
                },
                templateId: process.env.SENDGRID_TEMPLATE_ID || '', // Use your SendGrid template ID
                dynamicTemplateData: dynamicTemplateData
            };

            // Validate template ID before sending
            if (!msg.templateId) {
                throw new ServiceError('SENDGRID_TEMPLATE_ID environment variable is required');
            }

            const response = await sgMail.send(msg);

            const messageId = response[0].headers['x-message-id'] || 'unknown';

            return {
                success: true,
                messageId: messageId,
                verificationToken: verificationToken,
                expiresAt: expiresAt,
                message: 'Email verification sent successfully'
            };

        } catch (error: any) {
            // Extract more specific error message from SendGrid response
            let errorMessage = error.message;
            if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
                const sendGridErrors = error.response.body.errors.map((err: any) => err.message || err).join(', ');
                errorMessage = `SendGrid Error: ${sendGridErrors}`;
            }

            return {
                success: false,
                messageId: '',
                verificationToken: '',
                expiresAt: new Date(),
                error: `Failed to send email: ${errorMessage}`
            };
        }
    }

    /**
     * Verify email verification token
     */
    async verifyEmailToken(email: string, token: string): Promise<{
        success: boolean;
        message: string;
    }> {
        try {
            if (!email || !token) {
                throw new ValidationError('Email and token are required');
            }

            // Get stored token
            const storedData = this.verificationTokens.get(email);

            if (!storedData) {
                return {
                    success: false,
                    message: 'Invalid or expired verification token'
                };
            }

            // Check if token matches (support both full token and 6-digit code)
            const fullTokenMatch = storedData.token === token;
            const sixDigitMatch = storedData.token.substring(0, 6).toUpperCase() === token.toUpperCase();
            const isValidToken = fullTokenMatch || sixDigitMatch;

            if (!isValidToken) {
                return {
                    success: false,
                    message: 'Invalid verification token'
                };
            }

            // Check if token is expired
            const isExpired = new Date() > storedData.expiresAt;
            if (isExpired) {
                this.verificationTokens.delete(email);
                return {
                    success: false,
                    message: 'Verification token has expired'
                };
            }

            // Token is valid, remove it
            this.verificationTokens.delete(email);

            return {
                success: true,
                message: 'Email verified successfully'
            };

        } catch (error: any) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new ServiceError(`Failed to verify email: ${error.message}`);
        }
    }

    /**
     * Send general email using SendGrid
     */
    async sendEmail(options: SendEmailOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }> {
        try {
            if (!this.apiKey) {
                return {
                    success: false,
                    error: 'Email service not configured (missing SENDGRID_API_KEY)'
                };
            }

            const msg: any = {
                to: options.to,
                from: {
                    email: this.fromEmail,
                    name: APP_NAME
                },
                subject: options.subject
            };

            // Use template if provided
            if (options.templateId) {
                msg.templateId = options.templateId;
                msg.dynamicTemplateData = options.dynamicTemplateData || {};
            } else {
                // Use HTML/text content
                msg.html = options.htmlContent;
                msg.text = options.textContent;
            }

            const response = await sgMail.send(msg);

            return {
                success: true,
                messageId: response[0].headers['x-message-id'] || 'unknown'
            };

        } catch (error: any) {
            return {
                success: false,
                error: `Failed to send email: ${error.message}`
            };
        }
    }

}
