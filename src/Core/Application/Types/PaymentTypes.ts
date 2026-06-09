export type CurrencyCode = string;

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface FundingRequest extends Money {
  userId: string;
  reference?: string;
  paymentMethodId?: string;
  metadata?: Record<string, unknown>;
}

export interface FundingResult extends Money {
  provider: string;
  reference: string;
  status: PaymentEventStatus;
  providerTransactionId?: string;
  authorizationUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutRequest extends Money {
  userId: string;
  destinationAccountId: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutResult extends Money {
  provider: string;
  reference: string;
  status: PaymentEventStatus;
  providerPayoutId?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest {
  originalReference: string;
  amountMinor?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface BankResolutionRequest {
  bankCode: string;
  accountNumber: string;
  country?: string;
}

export interface BankResolutionResult {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  metadata?: Record<string, unknown>;
}

export enum PaymentEventStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export enum PaymentEventType {
  FUNDING_INITIATED = "funding.initiated",
  FUNDING_SUCCEEDED = "funding.succeeded",
  FUNDING_FAILED = "funding.failed",
  PAYOUT_INITIATED = "payout.initiated",
  PAYOUT_SUCCEEDED = "payout.succeeded",
  PAYOUT_FAILED = "payout.failed",
  REFUND_SUCCEEDED = "refund.succeeded",
  REFUND_FAILED = "refund.failed",
}

export interface NormalizedPaymentEvent extends Money {
  provider: string;
  eventId: string;
  type: PaymentEventType | string;
  status: PaymentEventStatus;
  reference: string;
  providerTransactionId?: string;
  occurredAt: string;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}
