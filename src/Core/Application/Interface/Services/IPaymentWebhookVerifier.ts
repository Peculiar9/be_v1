import type { NormalizedPaymentEvent } from "../../Types/PaymentTypes";

export interface IPaymentWebhookVerifier {
  verify(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent>;
}
