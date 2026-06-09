import { TYPES } from "@Core/Types/Constants";
import type { ISMSService } from "@Core/Application/Interface/Services/ISMSService";
import { SMSData } from "./data/SMSData";
import { inject, injectable } from "inversify";
import { SMSType } from "@Core/Application/Enums/SMSType";
import type { IAWSHelper } from "@Core/Application/Interface/Services/IAWSHelper";
import type { ITwilioService, TwilioVerificationOptions } from "@Core/Application/Interface/Services/ITwilioService";
import { ServiceError, ValidationError } from "@Core/Application/Error/AppError";
import { Console, LogLevel } from "../Utils/Console";

@injectable()
export class SMSService implements ISMSService {
    constructor(
        @inject(TYPES.AWSHelper) private readonly _awsHelper: IAWSHelper,
        @inject(TYPES.TwilioService) private readonly _twilioService: ITwilioService,
    ) { }

    /**
     * Verify OTP code sent to a phone number
     * @param data SMS data containing recipient phone number and verification code
     * @returns Verification result
     */
    async verifyOTP(data: SMSData): Promise<any> {
        try {
            if (!data.recipient || !data.message) {
                throw new ValidationError("Phone number and verification code are required");
            }

            // The message field contains the verification code
            const verificationResult = await this._twilioService.checkVerification(
                data.recipient,
                data.message
            );

            return {
                valid: verificationResult.valid,
                status: verificationResult.status,
                message: verificationResult.valid
                    ? "OTP verification successful"
                    : "Invalid or expired verification code"
            };
        } catch (error: any) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ServiceError(`Failed to verify OTP: ${error.message}`);
        }
    }

    /**
     * Send OTP SMS to a phone number
     * @param data SMS data containing recipient phone number
     * @returns Verification initiation result
     */
    async sendOTPSMS(data: SMSData): Promise<any> {
        try {
            if (!data.recipient) {
                throw new ValidationError("Phone number is required");
            }

            // Configure verification options
            const verificationOptions: TwilioVerificationOptions = {
                channel: 'sms'
            };

            // Start verification process which sends OTP via SMS
            const verificationResult = await this._twilioService.startVerification(
                data.recipient,
                verificationOptions
            );

            return {
                success: verificationResult.valid,
                status: verificationResult.status,
                sid: verificationResult.sid,
                to: verificationResult.to,
                channel: verificationResult.channel,
                message: "OTP SMS sent successfully"
            };
        } catch (error: any) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ServiceError(`Failed to send OTP SMS: ${error.message}`);
        }
    }

    async sendVerificationSMS(data: SMSData): Promise<any> {
        try {
            return await this._awsHelper.sendSMS(data, SMSType.SINGLE);
        } catch (error: any) {
            throw new ServiceError(`Failed to send verification SMS: ${error.message}`);
        }
    }

    async sendSMS(phoneNumber: string, message: string): Promise<any> {
        try {
            // Try to send SMS using Twilio first
            const twilioResult = await this._twilioService.sendSMS(phoneNumber, message);

            // If Twilio succeeds, return the result
            if (twilioResult.success) {
                return twilioResult;
            }

            // If Twilio fails, fall back to AWS SNS
            Console.write("Twilio SMS failed, falling back to AWS SNS", LogLevel.WARNING, { phoneNumber });
            const data = {
                recipient: phoneNumber,
                message: message
            }
            return await this._awsHelper.sendSMS(data, SMSType.SINGLE);
        } catch (error: any) {
            throw new ServiceError(error.message);
        }
    }
}
