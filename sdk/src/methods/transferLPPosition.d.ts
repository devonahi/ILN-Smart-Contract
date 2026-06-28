import { SorobanRpc, Account, Transaction } from "@stellar/stellar-sdk";
/**
 * Transfer a funded LP position to another address.
 *
 * Allows a liquidity provider to exit a position they have funded by handing
 * it to a new LP, without unwinding the underlying invoice. The caller
 * (`sourceAccount`) must be the current LP of the position.
 *
 * @param server Soroban RPC server
 * @param contractAddress Contract address
 * @param invoiceId The ID of the funded invoice whose position is transferred
 * @param newLP The G-address of the LP receiving the position
 * @param sourceAccount The account of the current LP
 * @param signTransaction A function to sign the transaction (e.g. Freighter or Keypair)
 * @param networkPassphrase The network passphrase
 * @returns Object containing txHash
 * @throws {ILNError.InvalidAddress} If newLP is not a valid Stellar G-address
 * @throws {ILNError.InvalidTransfer} If newLP is the same as the current LP
 * @throws {ILNError} When simulation or execution fails
 * @example
 * ```ts
 * const { txHash } = await transferLPPosition(server, contractAddress, 42n, "G...", sourceAccount, signTx, Networks.TESTNET);
 * ```
 */
export declare function transferLPPosition(server: SorobanRpc.Server, contractAddress: string, invoiceId: bigint, newLP: string, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<{
    txHash: string;
}>;
