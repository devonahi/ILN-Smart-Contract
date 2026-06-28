import { SorobanRpc, Account, Transaction } from "@stellar/stellar-sdk";
import type { SubmitInvoiceParams, SubmitInvoiceResult } from "../types/params.js";
/**
 * Submit a new invoice to the contract.
 * @param server Soroban RPC server
 * @param contractAddress Contract address
 * @param params Invoice parameters
 * @param sourceAccount The account of the freelancer/submitter
 * @param signTransaction A function to sign the transaction (e.g. Freighter or Keypair)
 * @param networkPassphrase The network passphrase
 * @returns Object containing invoiceId and txHash
 * @throws {ILNError.InvalidAmount} If amount is <= 0
 * @throws {ILNError.InvalidDiscountRate} If discount rate is not between 1 and 5000 bps
 * @throws {ILNError.DueDateTooSoon} If due date is < 24h
 * @throws {ILNError.DueDateTooFar} If due date is > 365 days
 * @throws {ILNError} If payer address is invalid or transaction fails
 * @example
 * ```ts
 * const { invoiceId, txHash } = await submitInvoice(server, contractAddress, {
 *   payer: "G...", amount: 1000n, dueDate: Date.now() / 1000 + 86400 * 30, discountRate: 300, token: "C..."
 * }, sourceAccount, signTx, Networks.TESTNET);
 * ```
 */
export declare function submitInvoice(server: SorobanRpc.Server, contractAddress: string, params: SubmitInvoiceParams, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<SubmitInvoiceResult>;
