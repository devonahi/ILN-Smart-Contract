"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvoice = cancelInvoice;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_js_1 = require("../errors.js");
const queries_js_1 = require("./queries.js");
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
async function cancelInvoice(server, contractAddress, invoiceId, sourceAccount, signTransaction, networkPassphrase) {
    // Read state first to validate
    const invoice = await (0, queries_js_1.getInvoice)(server, contractAddress, invoiceId, sourceAccount, networkPassphrase);
    if (invoice.status !== "Pending") {
        throw new errors_js_1.ILNError.InvoiceNotCancellable(`Invoice is in ${invoice.status} state, not Pending`);
    }
    const submitterAddress = sourceAccount.accountId();
    if (invoice.freelancer !== submitterAddress) {
        throw new errors_js_1.ILNError.Unauthorized("Only the invoice submitter can cancel it");
    }
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("cancel_invoice", (0, stellar_sdk_1.nativeToScVal)(submitterAddress, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(invoiceId, { type: "u64" }));
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
