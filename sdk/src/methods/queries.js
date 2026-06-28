"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoice = getInvoice;
exports.listInvoicesBySubmitter = listInvoicesBySubmitter;
exports.listInvoicesByLP = listInvoicesByLP;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_js_1 = require("../errors.js");
const fundInvoice_js_1 = require("./fundInvoice.js");
/**
 * Fetch a single invoice by its ID.
 * @param server Soroban RPC server instance
 * @param contractAddress The contract's address
 * @param invoiceId The invoice ID
 * @param sourceAccount Account used for simulation (does not consume sequence or fees)
 * @param networkPassphrase The network passphrase
 * @returns The invoice data including computed yield
 * @throws {ILNError.InvoiceNotFound} If the invoice does not exist
 * @throws {ILNError} On other simulation errors
 * @example
 * ```ts
 * const invoice = await getInvoice(server, contractAddress, 42n, sourceAccount, Networks.TESTNET);
 * console.log(`Invoice status: ${invoice.status}`);
 * ```
 */
async function getInvoice(server, contractAddress, invoiceId, sourceAccount, networkPassphrase) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("get_invoice", (0, stellar_sdk_1.nativeToScVal)(invoiceId, { type: "u64" }));
    const tx = new stellar_sdk_1.TransactionBuilder(sourceAccount, {
        fee: stellar_sdk_1.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    const sim = await server.simulateTransaction(tx);
    if (stellar_sdk_1.SorobanRpc.Api.isSimulationError(sim)) {
        if (String(sim.error).includes("NotFound") || String(sim.error).includes("Error(Contract, 1)")) {
            throw new errors_js_1.ILNError.InvoiceNotFound(`Invoice ${invoiceId} not found`);
        }
        throw errors_js_1.ILNError.fromError(sim.error);
    }
    if (!sim.result?.retval) {
        throw new errors_js_1.ILNError.InvoiceNotFound(`Invoice ${invoiceId} not found`);
    }
    const raw = (0, stellar_sdk_1.scValToNative)(sim.result.retval);
    const dueDate = Number(raw["due_date"]);
    const discountRate = Number(raw["discount_rate"]);
    return {
        id: BigInt(String(raw["id"])),
        freelancer: String(raw["freelancer"]),
        payer: String(raw["payer"]),
        token: String(raw["token"]),
        amount: BigInt(String(raw["amount"])),
        dueDate,
        discountRate,
        status: raw["status"]?.tag || String(raw["status"]), // handle scval enum
        funder: raw["funder"] ? String(raw["funder"]) : undefined,
        fundedAt: raw["funded_at"] ? Number(raw["funded_at"]) : undefined,
        amountFunded: BigInt(String(raw["amount_funded"])),
        amountPaid: BigInt(String(raw["amount_paid"])),
        referralCode: raw["referral_code"] ? Buffer.from(raw["referral_code"]).toString('hex') : undefined,
        submitterReputation: Number(raw["submitter_reputation"]),
        effectiveYieldBps: (0, fundInvoice_js_1.computeEffectiveYieldBps)(discountRate, dueDate),
    };
}
/**
 * List invoices submitted by a specific freelancer address.
 * @param server Soroban RPC server instance
 * @param contractAddress The contract's address
 * @param submitter The freelancer's address
 * @param sourceAccount Account used for simulation
 * @param networkPassphrase The network passphrase
 * @param page The page number (0-indexed)
 * @param pageSize The number of items per page
 * @returns Array of invoices
 * @throws {ILNError} On simulation errors
 * @example
 * ```ts
 * const invoices = await listInvoicesBySubmitter(server, contractAddress, "G...", sourceAccount, Networks.TESTNET, 0, 10);
 * ```
 */
async function listInvoicesBySubmitter(server, contractAddress, submitter, sourceAccount, networkPassphrase, page = 0, pageSize = 50) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("list_invoices_by_submitter", (0, stellar_sdk_1.nativeToScVal)(submitter, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(page, { type: "u32" }), (0, stellar_sdk_1.nativeToScVal)(pageSize, { type: "u32" }));
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
    if (!sim.result?.retval) {
        return [];
    }
    const rawArr = (0, stellar_sdk_1.scValToNative)(sim.result.retval);
    return rawArr.map(raw => {
        const dueDate = Number(raw["due_date"]);
        const discountRate = Number(raw["discount_rate"]);
        return {
            id: BigInt(String(raw["id"])),
            freelancer: String(raw["freelancer"]),
            payer: String(raw["payer"]),
            token: String(raw["token"]),
            amount: BigInt(String(raw["amount"])),
            dueDate,
            discountRate,
            status: raw["status"]?.tag || String(raw["status"]),
            funder: raw["funder"] ? String(raw["funder"]) : undefined,
            fundedAt: raw["funded_at"] ? Number(raw["funded_at"]) : undefined,
            amountFunded: BigInt(String(raw["amount_funded"])),
            amountPaid: BigInt(String(raw["amount_paid"])),
            referralCode: raw["referral_code"] ? Buffer.from(raw["referral_code"]).toString('hex') : undefined,
            submitterReputation: Number(raw["submitter_reputation"]),
            effectiveYieldBps: (0, fundInvoice_js_1.computeEffectiveYieldBps)(discountRate, dueDate),
        };
    });
}
/**
 * List invoices funded by a specific LP address.
 * @param server Soroban RPC server instance
 * @param contractAddress The contract's address
 * @param lp The liquidity provider's address
 * @param sourceAccount Account used for simulation
 * @param networkPassphrase The network passphrase
 * @param page The page number (0-indexed)
 * @param pageSize The number of items per page
 * @returns Array of invoices
 * @throws {ILNError} On simulation errors
 * @example
 * ```ts
 * const invoices = await listInvoicesByLP(server, contractAddress, "G...", sourceAccount, Networks.TESTNET, 0, 10);
 * ```
 */
async function listInvoicesByLP(server, contractAddress, lp, sourceAccount, networkPassphrase, page = 0, pageSize = 50) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("list_invoices_by_lp", (0, stellar_sdk_1.nativeToScVal)(lp, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(page, { type: "u32" }), (0, stellar_sdk_1.nativeToScVal)(pageSize, { type: "u32" }));
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
    if (!sim.result?.retval) {
        return [];
    }
    const rawArr = (0, stellar_sdk_1.scValToNative)(sim.result.retval);
    return rawArr.map(raw => {
        const dueDate = Number(raw["due_date"]);
        const discountRate = Number(raw["discount_rate"]);
        return {
            id: BigInt(String(raw["id"])),
            freelancer: String(raw["freelancer"]),
            payer: String(raw["payer"]),
            token: String(raw["token"]),
            amount: BigInt(String(raw["amount"])),
            dueDate,
            discountRate,
            status: raw["status"]?.tag || String(raw["status"]),
            funder: raw["funder"] ? String(raw["funder"]) : undefined,
            fundedAt: raw["funded_at"] ? Number(raw["funded_at"]) : undefined,
            amountFunded: BigInt(String(raw["amount_funded"])),
            amountPaid: BigInt(String(raw["amount_paid"])),
            referralCode: raw["referral_code"] ? Buffer.from(raw["referral_code"]).toString('hex') : undefined,
            submitterReputation: Number(raw["submitter_reputation"]),
            effectiveYieldBps: (0, fundInvoice_js_1.computeEffectiveYieldBps)(discountRate, dueDate),
        };
    });
}
