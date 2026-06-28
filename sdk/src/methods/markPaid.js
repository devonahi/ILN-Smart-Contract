"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markPaid = markPaid;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const queries_js_1 = require("./queries.js");
const errors_js_1 = require("../errors.js");
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
async function markPaid(server, contractAddress, invoiceId, amount, sourceAccount, signTransaction, networkPassphrase) {
    // Fetch invoice to get outstanding balance
    const invoice = await (0, queries_js_1.getInvoice)(server, contractAddress, invoiceId, sourceAccount, networkPassphrase);
    const outstanding = invoice.amount - invoice.amountPaid;
    const paymentAmount = amount !== undefined ? amount : outstanding;
    if (paymentAmount <= 0n) {
        throw new errors_js_1.ILNError.InsufficientAmount("Payment amount must be greater than 0");
    }
    if (paymentAmount > outstanding) {
        throw new errors_js_1.ILNError.InsufficientAmount("Payment amount exceeds outstanding balance");
    }
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const payerAddress = sourceAccount.accountId();
    const op = contract.call("mark_paid", (0, stellar_sdk_1.nativeToScVal)(invoiceId, { type: "u64" }), (0, stellar_sdk_1.nativeToScVal)(payerAddress, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(paymentAmount, { type: "i128" }));
    const tx = new stellar_sdk_1.TransactionBuilder(sourceAccount, {
        fee: stellar_sdk_1.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    const sim = await server.simulateTransaction(tx);
    if (stellar_sdk_1.SorobanRpc.Api.isSimulationError(sim)) {
        throw errors_js_1.ILNError.fromError(sim.error);
    }
    const assembledTx = stellar_sdk_1.SorobanRpc.assembleTransaction(tx, sim).build();
    const signedTx = await signTransaction(assembledTx);
    const sendResult = await server.sendTransaction(signedTx);
    if (sendResult.errorResultXdr) {
        throw new Error(`Transaction failed: ${sendResult.errorResultXdr}`);
    }
    // Poll for completion
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
    const remainingBalance = outstanding - paymentAmount;
    return {
        txHash: sendResult.hash,
        remainingBalance,
        fullySettled: remainingBalance === 0n,
    };
}
