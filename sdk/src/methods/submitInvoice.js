"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitInvoice = submitInvoice;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_js_1 = require("../errors.js");
const validate_js_1 = require("../utils/validate.js");
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
async function submitInvoice(server, contractAddress, params, sourceAccount, signTransaction, networkPassphrase) {
    // Validation
    if (params.amount <= 0n) {
        throw new errors_js_1.ILNError.InvalidAmount("Invoice amount must be greater than 0");
    }
    (0, validate_js_1.validateDiscountRate)(params.discountRate);
    const dueDateUnix = params.dueDate instanceof Date ? Math.floor(params.dueDate.getTime() / 1000) : params.dueDate;
    const nowUnix = Math.floor(Date.now() / 1000);
    const minDuration = 24 * 60 * 60;
    const maxDuration = 365 * 24 * 60 * 60;
    if (dueDateUnix < nowUnix + minDuration) {
        throw new errors_js_1.ILNError.DueDateTooSoon("Due date is too soon (minimum 24 hours)");
    }
    if (dueDateUnix > nowUnix + maxDuration) {
        throw new errors_js_1.ILNError.DueDateTooFar("Due date is too far (maximum 365 days)");
    }
    (0, validate_js_1.validateGAddress)(params.payer);
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const submitterAddress = sourceAccount.accountId();
    const tokenArg = (0, stellar_sdk_1.nativeToScVal)(params.token, { type: "address" });
    let refArg = (0, stellar_sdk_1.nativeToScVal)(undefined);
    if (params.referralCode) {
        const refBuffer = Buffer.from(params.referralCode, 'hex');
        refArg = (0, stellar_sdk_1.nativeToScVal)(refBuffer, { type: "bytes", size: 32 });
    }
    const op = contract.call("submit_invoice", (0, stellar_sdk_1.nativeToScVal)(submitterAddress, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(params.payer, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(params.amount, { type: "i128" }), (0, stellar_sdk_1.nativeToScVal)(dueDateUnix, { type: "u64" }), (0, stellar_sdk_1.nativeToScVal)(params.discountRate, { type: "u32" }), tokenArg, refArg);
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
    let invoiceId = 0n;
    if (status.status === stellar_sdk_1.SorobanRpc.Api.GetTransactionStatus.SUCCESS && status.returnValue) {
        invoiceId = BigInt(String((0, stellar_sdk_1.scValToNative)(status.returnValue)));
    }
    return { invoiceId, txHash: sendResult.hash };
}
