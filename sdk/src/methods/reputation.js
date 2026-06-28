"use strict";
/**
 * getReputation — read an address's detailed reputation profile from
 * the on-chain invoice-liquidity contract.
 *
 * Wraps the `get_reputation(address)` view function. Unknown addresses
 * return a zeroed profile (matching the contract's lazy-init behaviour).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReputation = getReputation;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
// ---------------------------------------------------------------------------
// G-address validation
// ---------------------------------------------------------------------------
const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
function isValidGAddress(address) {
    return G_ADDRESS_RE.test(address);
}
// ---------------------------------------------------------------------------
// getReputation
// ---------------------------------------------------------------------------
/**
 * Query the reputation profile for a Stellar address.
 *
 * Performs a read-only Soroban simulation — no on-chain mutation, no
 * transaction fees, and no signer required.
 *
 * @param server              - Soroban RPC server for the target network
 * @param contractId          - Deployed invoice-liquidity contract address
 * @param address             - Stellar G… address to look up
 * @param networkPassphrase   - Stellar network passphrase (default: TESTNET)
 * @returns ReputationProfile (zeroed for unknown / never-active addresses)
 *
 * @throws When `address` is not a valid Stellar G-address
 * @throws When the Soroban simulation fails (RPC unreachable, contract not found)
 *
 * @example
 * ```ts
 * const rep = await getReputation(server, CONTRACT_ID, "GAA...");
 * console.log(`Score: ${rep.score}, Submitted: ${rep.invoicesSubmitted}`);
 * ```
 */
async function getReputation(server, contractId, address, networkPassphrase = stellar_sdk_1.Networks.TESTNET) {
    if (!isValidGAddress(address)) {
        throw new Error(`Invalid Stellar address: "${address}". Must be a G… public key.`);
    }
    const contract = new stellar_sdk_1.Contract(contractId);
    const op = contract.call("get_reputation", new stellar_sdk_1.Address(address).toScVal());
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
        throw new Error(`get_reputation simulation failed: ${sim.error}`);
    }
    // The contract returns a zeroed ReputationProfile for unknown addresses
    if (!sim.result?.retval) {
        return {
            address,
            score: 0,
            invoicesSubmitted: 0,
            invoicesPaid: 0,
            invoicesDefaulted: 0,
        };
    }
    const raw = (0, stellar_sdk_1.scValToNative)(sim.result.retval);
    return {
        address: String(raw["address"] ?? address),
        score: Number(raw["score"] ?? 0),
        invoicesSubmitted: Number(raw["invoices_submitted"] ?? 0),
        invoicesPaid: Number(raw["invoices_paid"] ?? 0),
        invoicesDefaulted: Number(raw["invoices_defaulted"] ?? 0),
    };
}
