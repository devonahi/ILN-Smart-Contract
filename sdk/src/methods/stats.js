"use strict";
/**
 * getContractStats — fetch protocol-wide statistics from the contract.
 *
 * Reads the single `get_contract_stats()` view call. No signer or
 * transaction fees required (read-only simulation).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractStats = getContractStats;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
// ---------------------------------------------------------------------------
// getContractStats
// ---------------------------------------------------------------------------
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
async function getContractStats(server, contractId, networkPassphrase = stellar_sdk_1.Networks.TESTNET) {
    const contract = new stellar_sdk_1.Contract(contractId);
    const op = contract.call("get_contract_stats");
    const sourceAccount = new stellar_sdk_1.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const simTx = new stellar_sdk_1.TransactionBuilder(sourceAccount, {
        fee: stellar_sdk_1.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    const sim = await server.simulateTransaction(simTx);
    if (stellar_sdk_1.SorobanRpc.Api.isSimulationError(sim)) {
        throw new Error(`get_contract_stats simulation failed: ${sim.error}`);
    }
    if (!sim.result?.retval) {
        return {
            totalInvoices: 0n,
            totalFunded: 0n,
            totalPaid: 0n,
            totalVolumeUsdc: 0n,
            totalVolumeEurc: 0n,
            totalVolumeXlm: 0n,
            volumeByToken: {},
            totalVolumeUsdNormalized: 0n,
        };
    }
    const raw = (0, stellar_sdk_1.scValToNative)(sim.result.retval);
    // Parse per-token volumes: the contract returns a Vec<(Address, i128)>
    const volumeByToken = {};
    const rawTokenVolumes = raw["token_volumes"];
    if (Array.isArray(rawTokenVolumes)) {
        for (const [token, volume] of rawTokenVolumes) {
            volumeByToken[token] = BigInt(volume);
        }
    }
    return {
        totalInvoices: BigInt(String(raw["total_invoices"] ?? "0")),
        totalFunded: BigInt(String(raw["total_funded"] ?? "0")),
        totalPaid: BigInt(String(raw["total_paid"] ?? "0")),
        totalVolumeUsdc: BigInt(String(raw["total_volume_usdc"] ?? "0")),
        totalVolumeEurc: BigInt(String(raw["total_volume_eurc"] ?? "0")),
        totalVolumeXlm: BigInt(String(raw["total_volume_xlm"] ?? "0")),
        volumeByToken,
        totalVolumeUsdNormalized: BigInt(String(raw["total_volume_usd_normalized"] ?? "0")),
    };
}
