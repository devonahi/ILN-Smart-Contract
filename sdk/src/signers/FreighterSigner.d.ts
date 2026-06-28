/**
 * FreighterSigner — ISigner adapter for the Freighter browser extension.
 *
 * Intended for browser-based dApps where a Stellar wallet extension is
 * available. Detects whether Freighter is installed, requests network
 * access on first use, and delegates transaction signing to the wallet.
 *
 * ## Flow
 *
 *   1. `constructor` — stores configuration; does NOT touch the wallet.
 *   2. `publicKey` getter — triggers detection + access request, then caches
 *      the public key for the session.
 *   3. `signTransaction()` — hands the prepared XDR envelope to Freighter
 *      and returns the signed envelope as a base-64 string.
 *
 * ## Error handling
 *
 *   - `ILNError.WalletNotInstalled` — `window.freighterApi` is undefined
 *   - `ILNError.UserRejected`        — the user dismissed the Freighter prompt
 *   - `ILNError.NetworkMismatch`     — the wallet network differs from the
 *       configured network (e.g. wallet on mainnet but SDK on testnet)
 *
 * ## Network-mismatch detection
 *
 * Freighter returns the active network via `getNetwork()` (or
 * `getNetworkDetails()`). Before signing we compare it against the
 * configured `networkPassphrase` and throw `NetworkMismatch` when they
 * differ, avoiding hard-to-debug simulation failures downstream.
 */
import { SorobanRpc } from "@stellar/stellar-sdk";
import type { ISigner } from "./ISigner.js";
import type { Transaction } from "@stellar/stellar-sdk";
interface FreighterApi {
    isConnected(): Promise<boolean>;
    getPublicKey(): Promise<string>;
    getNetwork(): Promise<string>;
    signTransaction(xdr: string, opts?: {
        network?: string;
        networkPassphrase?: string;
    }): Promise<string>;
}
declare global {
    interface Window {
        freighterApi?: FreighterApi;
    }
}
/** SDK-level error with a machine-readable code. */
export declare class ILNError extends Error {
    readonly code: ILNErrorCode;
    constructor(code: ILNErrorCode, message: string);
    static WalletNotInstalled(): ILNError;
    static UserRejected(): ILNError;
    static NetworkMismatch(expected: string, actual: string): ILNError;
    static NotConnected(): ILNError;
}
/** Error codes for programmatic handling. */
export declare enum ILNErrorCode {
    WalletNotInstalled = "WALLET_NOT_INSTALLED",
    UserRejected = "USER_REJECTED",
    NetworkMismatch = "NETWORK_MISMATCH",
    NotConnected = "NOT_CONNECTED",
    SigningFailed = "SIGNING_FAILED"
}
/**
 * Browser wallet signer backed by the Freighter extension.
 *
 * @example
 * ```ts
 * // Testnet
 * const signer = new FreighterSigner({ networkPassphrase: Networks.TESTNET });
 * console.log(signer.publicKey); // triggers Freighter access prompt
 *
 * // Mainnet
 * const signer = new FreighterSigner({ networkPassphrase: Networks.PUBLIC });
 *
 * // Sign a transaction
 * const signedXdr = await signer.signTransaction(tx, rpcServer);
 * ```
 */
export declare class FreighterSigner implements ISigner {
    private readonly _networkPassphrase;
    private _publicKey;
    private _accessRequested;
    /**
     * @param opts.networkPassphrase - Stellar network passphrase the SDK is
     *   targeting (e.g. `Networks.TESTNET`). Used to verify Freighter's active
     *   network before signing.
     */
    constructor(opts: {
        networkPassphrase: string;
    });
    /**
     * The Freighter account's G… public key.
     *
     * Returns an empty string `""` until `connect()` has been called
     * successfully. Use `isConnected` to check whether the public key is
     * available, or call `connect()` early (e.g. on page load) so the
     * key is populated before it's needed.
     */
    get publicKey(): string;
    /**
     * Explicitly connect to Freighter, request access, and cache the public key.
     *
     * Call this early (e.g. on page load) so `publicKey` is available
     * synchronously afterwards.
     *
     * @returns The public key (G…)
     * @throws {ILNError} WalletNotInstalled | NotConnected | UserRejected | NetworkMismatch
     */
    connect(): Promise<string>;
    /**
     * Simulate the transaction, then sign with Freighter and return the
     * signed XDR envelope.
     *
     * Steps:
     *  1. `server.prepareTransaction(tx)` — attaches Soroban footprint
     *  2. Serialize to base-64 XDR
     *  3. Pass to Freighter's `signTransaction`
     *  4. Return the signed XDR
     *
     * @param tx     - Unsigned transaction with Soroban operations
     * @param server - Soroban RPC server for simulation
     * @returns Signed base-64 XDR envelope
     * @throws {ILNError} WalletNotInstalled | NotConnected | UserRejected | NetworkMismatch
     */
    signTransaction(tx: Transaction, server: SorobanRpc.Server): Promise<string>;
    /** The configured network passphrase. */
    get networkPassphrase(): string;
    /** True once `connect()` has succeeded. */
    get isConnected(): boolean;
    /** Throw if the Freighter extension isn't installed. */
    private _ensureInstalled;
    /** Return the Freighter API object (asserts it's installed). */
    private _api;
    /**
     * Compare the wallet's active network against the configured passphrase.
     * Throws `NetworkMismatch` when they diverge.
     */
    private _verifyNetwork;
    /** Classify a raw error from Freighter into a typed ILNError. */
    private _classifySignError;
}
export {};
