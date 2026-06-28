import { SorobanRpc, Account, Transaction } from "@stellar/stellar-sdk";
import type { MarkPaidResult } from "../types/params.js";
/**
 * Mark an invoice as paid (supports partial payments).
 * @param server Soroban RPC server
 * @param contractAddress Contract address
 * @param invoiceId The invoice ID
 * @param amount Optional amount to pay. If omitted, pays the full remaining balance.
 * @param sourceAccount The account of the payer
 * @param signTransaction A function to sign the transaction
 * @param networkPassphrase The network passphrase
 * @returns Object with txHash, remainingBalance and fullySettled flag
 * @throws {ILNError.InsufficientAmount} If payment amount is <= 0 or exceeds outstanding balance
 * @throws {ILNError} When simulation or execution fails
 * @example
 * ```ts
 * const result = await markPaid(server, contractAddress, 42n, 100n, sourceAccount, signTx, Networks.TESTNET);
 * console.log(`Remaining balance: ${result.remainingBalance}`);
 * ```
 */
export declare function markPaid(server: SorobanRpc.Server, contractAddress: string, invoiceId: bigint, amount: bigint | undefined, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<MarkPaidResult>;
