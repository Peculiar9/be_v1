import { EmailOTPDTO, EmailVerificationResponse } from '../../DTOs/EmailDTO';
import type { EmailData } from '@Infrastructure/Services/data/EmailData';

export interface IEmailService {
    sendVerificationEmail(data: EmailData, userSalt: string, next: string): Promise<boolean>;
    sendPasswordResetEmail(data: EmailOTPDTO): Promise<boolean>;
    sendWelcomeEmail(data: EmailData): Promise<boolean>;
    sendProfileUpdateEmail(data: EmailData): Promise<boolean>;
    
    // OTP related methods
    sendOTPEmail(data: EmailOTPDTO): Promise<EmailVerificationResponse>;
    sendPasswordResetOTPEmail(data: EmailOTPDTO): Promise<EmailVerificationResponse>;
    resendOTPEmail(email: string, reference: string): Promise<EmailVerificationResponse>;
    verifyOTPEmail(email: string, otp: string, reference: string): Promise<EmailVerificationResponse>;
}
