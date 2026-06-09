export enum PaymentTransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

export enum PaymentTransactionType {
  FUNDING = 'funding',
  PAYOUT = 'payout',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment'
}

export interface PaymentTransaction {
  _id?: string;
  user_id: string;
  amountMinor: number;
  currency: string;
  status: PaymentTransactionStatus | string;
  type: PaymentTransactionType | string;
  provider: string;
  provider_transaction_id?: string;
  payment_reference?: string;
  payment_method_id?: string;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
