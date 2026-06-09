import { OTP } from '../../../Types/OTP';
import { VerificationStatus } from './IUser';

export interface IVerification {
    _id?: string;
    user_id: string | undefined;
    type?: VerificationType | string;
    identifier?: string;
    reference: string;
    otp?: OTP;
    code?: string;
    attempts?: number;
    status?: VerificationStatus | string;
    expiry?: number;
    metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export enum VerificationType {
    PHONE = 'phone',
    EMAIL = 'email',
    OAUTH = 'oauth',
    OTP = 'otp',
    CUSTOM = 'custom',
}

export interface IUserKYC {
  _id?: string;
  user_id: string;
  current_stage: KYCStage;
  status: KYCStatus;
  last_updated: Date | string;
  failure_reason?: string | null;
  stage_metadata: Record<string, unknown>;
}


export enum KYCStage {
    NOT_STARTED = 'not-started',
    PROFILE = 'profile',
    EMAIL = 'email',
    PHONE = 'phone',
    IDENTITY = 'identity',
    DOCUMENT = 'document',
    ADDRESS = 'address',
    REVIEW = 'review',
    COMPLETED = 'completed'
  }
  
  export enum KYCStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in-progress',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    COMPLETED = 'completed',
    FAILED = 'failed'
  }
