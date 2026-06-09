import { APP_NAME, TYPES } from "@Core/Types/Constants";
import { TransactionManager } from "peculiar-orm";
import type { IEmailService } from "@Core/Application/Interface/Services/IEmailService";
import type { IAWSHelper } from "@Core/Application/Interface/Services/IAWSHelper";
import { inject, injectable } from "inversify";
import { EmailOTPDTO, EmailVerificationResponse } from "@Core/Application/DTOs/EmailDTO";
import { VerificationType } from "@Core/Application/Interface/Entities/auth-and-user/IVerification";
import { VerificationRepository } from "../Repository/SQL/auth/VerificationRepository";
import { UtilityService } from "@Core/Services/UtilityService";
import { AppError, ServiceError, ValidationError } from "@Core/Application/Error/AppError";
import type { EmailData } from "./data/EmailData";
import { BaseService } from "./base/BaseService";

type EmailOtpVerificationOutcome = {
    response: EmailVerificationResponse;
} | {
    error: ValidationError;
};

@injectable()
export class EmailService extends BaseService implements IEmailService {
    constructor(
        @inject(TYPES.AWSHelper) private readonly _awsHelper: IAWSHelper,
        @inject(TYPES.VerificationRepository) private readonly verificationRepository: VerificationRepository,
        @inject(TYPES.TransactionManager) protected readonly transactionManager: TransactionManager
    ) {
        super(transactionManager);
    }

    async sendOTPEmail(data: EmailOTPDTO): Promise<EmailVerificationResponse> {
        try {
            if (!UtilityService.isValidEmail(data.email)) {
                throw new ValidationError('Invalid email format');
            }

            const otp = data.otpCode as string;
            const expiry = Date.now() + (15 * 60 * 1000); // 15 minutes

            const reference = UtilityService.generateUUID();

            // NOTE: OTP verification data is stored in onboarding_progress.stage_data
            // NOT in the verifications table

            const userName = data.firstName || data.email.split('@')[0];
            const emailData = {
                recipient: data.firstName || data.email,
                ...data,
                otpCode: otp,
                otpExpiry: 15, // minutes
                userName
            };
            await this._awsHelper.sendOTPEmail(data.email, emailData);

            return {
                success: true,
                message: 'OTP sent successfully',
                reference: reference,
                expiry,
                remainingAttempts: 3,
                code: otp // Return the OTP code so caller can store it
            };
        } catch (error: any) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new ServiceError(error.message);
        }
    }

    async sendPasswordResetOTPEmail(data: EmailOTPDTO): Promise<EmailVerificationResponse> {
        try {
            if (!UtilityService.isValidEmail(data.email)) {
                throw new ValidationError('Invalid email format');
            }

            const otp = data.otpCode as string;
            const expiry = Date.now() + (15 * 60 * 1000); // 15 minutes

            const reference = UtilityService.generateUUID();

            const verification = await this.withTransaction(async () => {
                return await this.verificationRepository.create({
                    identifier: data.email,
                    type: VerificationType.EMAIL,
                    otp: {
                        code: await UtilityService.hashOTP(otp),
                        attempts: 0,
                        expiry: UtilityService.dateToUnix(expiry),
                        last_attempt: null,
                        verified: false
                    },
                    user_id: data.userId,
                    expiry: UtilityService.dateToUnix(expiry),
                    reference
                });
            });

            const userName = data.firstName || data.email.split('@')[0];
            const emailData = {
                recipient: data.email,
                ...data,
                otpCode: otp,
                otpExpiry: 15, // minutes
                userName,
                CompanyName: APP_NAME
            };

            await this._awsHelper.sendPasswordResetOTPEmail(data.email, emailData);

            return {
                success: true,
                message: 'Password reset OTP sent successfully',
                reference: verification.reference,
                expiry,
                remainingAttempts: 3
            };
        } catch (error: any) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new ServiceError(error.message);
        }
    }

    async resendOTPEmail(email: string, reference: string): Promise<EmailVerificationResponse> {
        try {
            const resendData = await this.withTransaction(async () => {
                const verification = await this.verificationRepository.findByReference(reference);
                if (!verification || verification.identifier !== email) {
                    throw new ValidationError('Invalid verification reference');
                }

                if (verification.otp?.last_attempt) {
                    const lastAttempt = verification.otp.last_attempt;
                    const lastAttemptMillis = lastAttempt > 9999999999 ? lastAttempt : lastAttempt * 1000;
                    const timeSinceLastAttempt = Date.now() - lastAttemptMillis;
                    if (timeSinceLastAttempt < 60000) {
                        throw new ValidationError('Please wait before requesting another OTP');
                    }
                }

                const otp = UtilityService.generateOTP();
                const expiry = Date.now() + (15 * 60 * 1000);
                const expiryUnix = UtilityService.dateToUnix(expiry);
                const currentTime = UtilityService.dateToUnix(new Date());

                await this.verificationRepository.update(verification._id!, {
                    otp: {
                        code: await UtilityService.hashOTP(otp),
                        attempts: 0,
                        expiry: expiryUnix,
                        last_attempt: currentTime,
                        verified: false
                    },
                    expiry: expiryUnix
                });

                return { verification, otp, expiry };
            });

            await this._awsHelper.sendOTPEmail(email, {
                recipient: email,
                email,
                otpCode: resendData.otp,
                otpExpiry: 15
            });

            return {
                success: true,
                message: 'OTP resent successfully',
                reference: resendData.verification.reference,
                expiry: resendData.expiry,
                remainingAttempts: 3
            };
        } catch (error: any) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new ServiceError(error.message);
        }
    }

    async verifyOTPEmail(email: string, otp: string, reference: string): Promise<EmailVerificationResponse> {
        try {
            const result = await this.withTransaction(async (): Promise<EmailOtpVerificationOutcome> => {
                const verification = await this.verificationRepository.findByReference(reference);
                if (!verification || verification.identifier !== email) {
                    throw new ValidationError('Invalid verification reference');
                }

                const currentTime = UtilityService.dateToUnix(new Date());
                if (!verification.expiry || verification.expiry < currentTime) {
                    return { error: new ValidationError('OTP has expired') };
                }

                if (!verification.otp) {
                    return { error: new ValidationError('Invalid verification reference') };
                }

                if (verification.otp.attempts >= 3) {
                    return { error: new ValidationError('Maximum attempts exceeded') };
                }

                const isValid = await UtilityService.verifyOTP(otp, verification.otp.code);
                const attempts = verification.otp.attempts + 1;

                await this.verificationRepository.update(verification._id!, {
                    otp: {
                        ...verification.otp,
                        attempts,
                        last_attempt: currentTime,
                        verified: isValid
                    }
                });

                if (!isValid) {
                    return { error: new ValidationError('Invalid OTP') };
                }

                return {
                    response: {
                        success: true,
                        message: 'OTP verified successfully',
                        reference: verification.reference
                    }
                };
            });

            if ('error' in result) {
                throw result.error;
            }

            return result.response;
        } catch (error: any) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new ServiceError(error.message);
        }
    }
    async sendVerificationEmail(data: EmailData, userSalt: string, next: string): Promise<boolean> {
        void userSalt;
        void next;
        try {
            const emailResult = await this._awsHelper.sendVerificationEmail(data.email ?? data.recipient, data);
            return emailResult;
        } catch (error: any) {
            throw new ServiceError(error.message);
        }
    }

    async sendPasswordResetEmail(data: EmailOTPDTO): Promise<boolean> {
        try {
            const emailData = {
                recipient: data.email,
                ...data,
                otpCode: data.otpCode,
                otpExpiry: 15,
                userName: data.firstName || data.email.split('@')[0],
                CompanyName: APP_NAME
            };
            const emailResult = await this._awsHelper.sendForgotPasswordEmail(data.email, emailData);
            return emailResult;
        } catch (error: any) {
            throw new ServiceError(error.message);
        }
    }

    async sendWelcomeEmail(data: EmailData): Promise<boolean> {
        try {
            const emailResult = await this._awsHelper.sendWaitlistEmail(data.email ?? data.recipient, data);
            return emailResult;
        } catch (error: any) {
            throw new ServiceError(error.message);
        }
    }

    async sendProfileUpdateEmail(data: EmailData): Promise<boolean> {
        try {
            const emailResult = await this._awsHelper.sendProfileUpdateEmail(data.email ?? data.recipient, data);
            return emailResult;
        } catch (error: any) {
            throw new ServiceError(error.message);
        }
    }
}
