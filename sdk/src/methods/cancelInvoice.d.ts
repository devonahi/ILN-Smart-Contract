import { SorobanRpc, Account, Transaction } from "@stellar/stellar-sdk";
/**
 * Cancel a pending invoice.
 * @param server Soroban RPC server
 * @param contractAddress Contract address
 * @param invoiceId The ID of the invoice to cancel
 * @param sourceAccount The account of the freelancer/submitter
 * @param signTransaction A function to sign the transaction (e.g. Freighter or Keypair)
 * @param networkPassphrase The network passphrase
 * @returns Object containing txHash
 * @throws {ILNError.InvoiceNotCancellable} When the invoice is not in a Pending state
 * @throws {ILNError.Unauthorized} When caller is not the invoice submitter
 * @throws {ILNError} When simulation or execution fails
 * @example
 * ```ts
 * const { txHash } = await cancelInvoice(server, contractAddress, 42n, sourceAccount, signTx, Networks.TESTNET);
 * console.log(txHash);
 * ```
 */
export declare function cancelInvoice(server: SorobanRpc.Server, contractAddress: string, invoiceId: bigint, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<{
    txHash: string;
}>;
