import { Column, ForeignKey, Index } from "peculiar-orm";
import { TableNames } from "../Enums/TableNames";
import type { IVerification } from "../Interface/Entities/auth-and-user/IVerification";
import { VerificationType } from "../Interface/Entities/auth-and-user/IVerification";
import { VerificationStatus } from "../Interface/Entities/auth-and-user/IUser";
import type { OTP } from "../Types/OTP";

export class Verification implements IVerification {
  @Column("UUID PRIMARY KEY DEFAULT gen_random_uuid()")
  _id?: string;

  @Index({ unique: false })
  @ForeignKey({ table: TableNames.USERS, field: "_id" })
  @Column("UUID DEFAULT NULL")
  user_id: string;

  @Column("VARCHAR(32) NOT NULL")
  type: VerificationType | string;

  @Index({ unique: false })
  @Column("VARCHAR(255) DEFAULT NULL")
  identifier: string;

  @Index({ unique: true })
  @Column("VARCHAR(255) NOT NULL UNIQUE")
  reference: string;

  @Column("JSONB DEFAULT NULL")
  otp?: OTP;

  @Column("VARCHAR(32) NOT NULL DEFAULT 'pending'")
  status: VerificationStatus | string;

  @Column("BIGINT DEFAULT NULL")
  expiry?: number;

  @Column("JSONB DEFAULT '{}'::jsonb")
  metadata?: Record<string, unknown>;

  @Column("TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
  created_at?: string;

  @Column("TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
  updated_at?: string;

  constructor(data?: Partial<IVerification>) {
    Object.assign(this, data ?? {});
    this.type ??= VerificationType.OTP;
    this.status ??= VerificationStatus.PENDING;
  }
}
