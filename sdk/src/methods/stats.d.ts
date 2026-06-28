/**
 * getContractStats — fetch protocol-wide statistics from the contract.
 *
 * Reads the single `get_contract_stats()` view call. No signer or
 * transaction fees required (read-only simulation).
 */
import { SorobanRpc } from "@stellar/stellar-sdk";
/**
 * Protocol-wide statistics returned by `get_contract_stats()`.
 *
 * Mirrors `ContractStats` in the Rust contract.
 */
export interface ContractStats {
    /** Total number of invoices ever created. */
    totalInvoices: bigint;
    /** Cumulative number of fully-funded invoices. */
    totalFunded: bigint;
    /** Cumulative number of paid invoices. */
    totalPaid: bigint;
    /** Total USDC volume (in stroops, 6 decimals). */
    totalVolumeUsdc: bigint;
    /** Total EURC volume (in stroops, 6 decimals). */
    totalVolumeEurc: bigint;
    /** Total XLM volume (in stroops, 7 decimals). */
    totalVolumeXlm: bigint;
    /** Per-token volume map: token address → volume. */
    volumeByToken: Record<string, bigint>;
    /** Total volume normalized to USD (depends on oracle price feed). */
    totalVolumeUsdNormalized: bigint;
}
/**
 * Query protocol-wide statistics from the contract.
 *
 * Read-only — no signer, no fees, no on-chain mutation.
 *
 * @param server              - Soroban RPC server for the target network
 * @param contractId          - Deployed invoice-liquidity contract address
 * @param networkPassphrase   - Stellar network passphrase (default: TESTNET)
 * @returns ContractStats
 *
 * @throws When the Soroban simulation fails (RPC unreachable, contract not found)
 *
 * @example
 * ```ts
 * const stats = await getContractStats(server, CONTRACT_ID);
 * console.log(`Total invoices: ${stats.totalInvoices}`);
 * console.log(`USDC volume:    ${stats.totalVolumeUsdc}`);
 * ```
 */
export declare function getContractStats(server: SorobanRpc.Server, contractId: string, networkPassphrase?: string): Promise<ContractStats>;
