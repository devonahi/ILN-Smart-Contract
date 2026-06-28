import { SorobanRpc, Account } from "@stellar/stellar-sdk";
import type { Invoice } from "../types/invoice.js";
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
export declare function getInvoice(server: SorobanRpc.Server, contractAddress: string, invoiceId: bigint, sourceAccount: Account, networkPassphrase: string): Promise<Invoice>;
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
export declare function listInvoicesBySubmitter(server: SorobanRpc.Server, contractAddress: string, submitter: string, sourceAccount: Account, networkPassphrase: string, page?: number, pageSize?: number): Promise<Invoice[]>;
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
export declare function listInvoicesByLP(server: SorobanRpc.Server, contractAddress: string, lp: string, sourceAccount: Account, networkPassphrase: string, page?: number, pageSize?: number): Promise<Invoice[]>;
