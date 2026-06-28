/**
 * Real-time ILN contract event subscription backed by Horizon's SSE
 * `/effects` + `/contract-events` streaming endpoint.
 *
 * Features
 * --------
 * - Typed discriminated-union events (ILNEvent)
 * - Client-side filtering by event type, invoiceId, and address
 * - Transparent reconnection with exponential back-off on stream errors
 * - Clean `Unsubscribe` tear-down function returned to the caller
 */
import { Server as HorizonServer } from "@stellar/stellar-sdk/lib/horizon/index.js";
import type { EventFilter, ILNEvent, Unsubscribe } from "./types.js";
interface HorizonContractEvent {
    type: string;
    /** Array of base-64 XDR ScVal strings representing the topics. */
    topic: string[];
    /** Base-64 XDR ScVal string for the event body / value. */
    value: string;
    contractId?: string;
    ledger?: number;
    ledgerClosedAt?: string;
    txHash?: string;
    id?: string;
}
/**
 * Parse a raw Horizon contract-event record into a typed ILNEvent.
 *
 * Returns `null` when the event cannot be decoded or is not a known ILN type.
 */
export declare function parseContractEvent(raw: HorizonContractEvent): ILNEvent | null;
/**
 * Returns true when the parsed event satisfies the caller's EventFilter.
 */
export declare function matchesFilter(event: ILNEvent, filter: EventFilter): boolean;
/**
 * Subscribe to real-time ILN contract events via Horizon's SSE stream.
 *
 * Handles stream disconnection with exponential back-off (500 ms → 30 s).
 * The returned `Unsubscribe` function closes the stream and cancels any
 * pending reconnection timer.
 *
 * @param horizon         - Horizon server instance (use `new Server(horizonUrl)`)
 * @param contractId      - Deployed invoice-liquidity contract address
 * @param filter          - Optional criteria; empty object matches all events
 * @param handler         - Called once per matching decoded event
 * @param onError         - Optional error callback for logging / monitoring
 * @returns Unsubscribe   - Call to stop the stream
 *
 * @example
 * ```ts
 * const unsub = subscribe(horizon, CONTRACT_ID, { types: ["funded", "paid"] },
 *   (event) => console.log(event));
 * // later…
 * unsub();
 * ```
 */
export declare function subscribe(horizon: HorizonServer, contractId: string, filter: EventFilter, handler: (event: ILNEvent) => void, onError?: (err: unknown) => void): Unsubscribe;
export {};
