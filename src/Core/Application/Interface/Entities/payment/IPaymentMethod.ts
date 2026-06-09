export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_ACCOUNT = 'bank_account',
  DIGITAL_WALLET = 'digital_wallet'
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

export interface IPaymentMethod {
  _id?: string;
  user_id: string;
  type: PaymentMethodType | string;
  provider: string;
  provider_payment_method_id: string;
  status: PaymentMethodStatus | string;
  is_default: boolean;
  nickname?: string;
  last_four?: string;
  expiry_month?: number;
  expiry_year?: number;
  card_brand?: string;
  billing_details?: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}
