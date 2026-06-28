/**
 * Centralised input validation utilities for the ILN SDK.
 *
 * Validation logic for Stellar G-addresses, contract IDs, amounts, discount
 * rates and due dates was previously duplicated across method implementations.
 * Concentrating it here keeps error messages consistent and reduces bugs.
 *
 * Each validator throws a typed {@link ILNError} on failure and returns `void`
 * on success, so they can be used as guard clauses at the top of methods.
 */
import type { SupportedToken } from "../types/params.js";
/** Minimum allowed discount rate in basis points. */
export declare const MIN_DISCOUNT_BPS = 1;
/** Maximum allowed discount rate in basis points (50%). */
export declare const MAX_DISCOUNT_BPS = 5000;
/** Minimum invoice duration: 24 hours from now. */
export declare const MIN_DUE_DATE_MS: number;
/** Maximum invoice duration: 365 days from now. */
export declare const MAX_DUE_DATE_MS: number;
/**
 * Validate a Stellar account (G…) address.
 *
 * @param address - The address to validate
 * @throws {ILNError.InvalidAddress} If the address is empty, not a string, does
 *   not start with `G`, or is not 56 characters long.
 */
export declare function validateGAddress(address: string): void;
/**
 * Validate a Soroban contract (C…) address.
 *
 * @param contractId - The contract ID to validate
 * @throws {ILNError.InvalidAddress} If the contract ID is malformed.
 */
export declare function validateContractId(contractId: string): void;
/**
 * Validate a token amount against a minimum and the token's precision.
 *
 * @param amount - The amount in token base units
 * @param min    - The minimum allowed amount (inclusive) in base units
 * @param token  - The token the amount is denominated in
 * @throws {ILNError.InvalidAmount} If the amount is not a positive integer, is
 *   below the minimum, or exceeds the token's precision.
 */
export declare function validateAmount(amount: bigint, min: bigint, token: SupportedToken): void;
/**
 * Validate a discount rate.
 *
 * @param rate - Discount rate in basis points (1–5000)
 * @throws {ILNError.InvalidDiscountRate} If the rate is outside the 1–5000 bps range.
 */
export declare function validateDiscountRate(rate: number): void;
/**
 * Validate an invoice due date.
 *
 * @param date - The due date
 * @throws {ILNError.InvalidDueDate} If the date is invalid.
 * @throws {ILNError.DueDateTooSoon} If the date is less than 24h from now.
 * @throws {ILNError.DueDateTooFar} If the date is more than 365 days from now.
 */
export declare function validateDueDate(date: Date): void;
