/**
 * @iln/sdk — Invoice Liquidity Network TypeScript SDK
 *
 * Public surface area re-exported from this entry point.
 */

export { fundInvoice, computeEffectiveYieldBps } from "./methods/fundInvoice.js";
export {
  getAllowance,
  buildApproveTransaction,
  isAllowanceSufficient,
} from "./utils/allowance.js";
export { KeypairSigner } from "./signers/KeypairSigner.js";
export { subscribe, parseContractEvent, matchesFilter } from "./events/subscribe.js";
export type { ISigner } from "./signers/ISigner.js";
export type {
  FundOptions,
  FundResult,
  InvoiceView,
  AllowanceParams,
  AllowanceResult,
} from "./types.js";
export type {
  ILNEvent,
  ILNEventType,
  EventFilter,
  Unsubscribe,
} from "./events/types.js";
