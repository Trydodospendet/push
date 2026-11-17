/** Manual Jest mock: the Stripe PaymentSheet is native code. */
export const initPaymentSheet = jest.fn(async () => ({}));
export const presentPaymentSheet = jest.fn(async () => ({}));
export const StripeProvider = ({ children }: { children: unknown }) => children;
