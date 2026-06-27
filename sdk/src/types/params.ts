export type SupportedToken = 'USDC' | 'EURC' | 'XLM' | string;

export interface SubmitInvoiceParams {
  payer: string;
  amount: bigint;
  token: SupportedToken;
  discountRate: number;
  dueDate: Date | number;
  referralCode?: string;
}

export interface SubmitInvoiceResult {
  invoiceId: bigint;
  txHash: string;
}

export interface MarkPaidResult {
  txHash: string;
  remainingBalance: bigint;
  fullySettled: boolean;
}
