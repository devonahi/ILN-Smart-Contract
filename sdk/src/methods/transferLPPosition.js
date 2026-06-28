"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferLPPosition = transferLPPosition;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_js_1 = require("../errors.js");
const validate_js_1 = require("../utils/validate.js");
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
async function transferLPPosition(server, contractAddress, invoiceId, newLP, sourceAccount, signTransaction, networkPassphrase) {
    // Validate the destination address up-front.
    (0, validate_js_1.validateGAddress)(newLP);
    const currentLP = sourceAccount.accountId();
    if (newLP === currentLP) {
        throw new errors_js_1.ILNError.InvalidTransfer("New LP must be different from the current LP");
    }
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("transfer_lp_position", (0, stellar_sdk_1.nativeToScVal)(invoiceId, { type: "u64" }), (0, stellar_sdk_1.nativeToScVal)(currentLP, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(newLP, { type: "address" }));
    const tx = new stellar_sdk_1.TransactionBuilder(sourceAccount, {
        fee: stellar_sdk_1.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    // Simulate to catch contract errors
    const sim = await server.simulateTransaction(tx);
    if (stellar_sdk_1.SorobanRpc.Api.isSimulationError(sim)) {
        throw errors_js_1.ILNError.fromError(sim.error);
    }
    const assembledTx = stellar_sdk_1.SorobanRpc.assembleTransaction(tx, sim).build();
    // Sign
    const signedTx = await signTransaction(assembledTx);
    // Submit
    const sendResult = await server.sendTransaction(signedTx);
    if (sendResult.errorResultXdr) {
        throw new Error(`Transaction failed: ${sendResult.errorResultXdr}`);
    }
    // Wait for completion
    let status = await server.getTransaction(sendResult.hash);
    let retries = 0;
    while (status.status === stellar_sdk_1.SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && retries < 15) {
        await new Promise(r => setTimeout(r, 2000));
        status = await server.getTransaction(sendResult.hash);
        retries++;
    }
    if (status.status === stellar_sdk_1.SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error("Transaction failed during execution");
    }
    return { txHash: sendResult.hash };
}
