import type {
  BankResolutionRequest,
  BankResolutionResult,
  FundingRequest,
  FundingResult,
  PayoutRequest,
  PayoutResult,
  RefundRequest,
} from "../../Types/PaymentTypes";

export interface IPaymentGateway {
  fund(request: FundingRequest): Promise<FundingResult>;
  payout(request: PayoutRequest): Promise<PayoutResult>;
  refund(request: RefundRequest): Promise<FundingResult>;
  resolveBankAccount(request: BankResolutionRequest): Promise<BankResolutionResult>;
}
