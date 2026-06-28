/**
 * KeypairSigner — ISigner adapter for raw Stellar keypairs.
 *
 * Intended for Node.js scripts, CLI tools, and bots where a browser wallet
 * is not available. Accepts either a `Keypair` instance or a secret-key
 * string (S…).
 *
 * Two-step flow on every `signTransaction()` call:
 *   1. Simulate the transaction via `server.prepareTransaction()` to fetch
 *      the Soroban footprint (ledger entries, auth entries, resource limits).
 *   2. Sign the *prepared* transaction and return the signed XDR envelope.
 *
 * Security notice
 * ---------------
 * Hard-coding secret keys in source files is dangerous. KeypairSigner emits
 * a `console.warn` when it detects that the process is not running inside a
 * test environment (`NODE_ENV !== "test"`) **and** the secret was supplied as
 * a plain string literal. Pass the secret via an environment variable instead:
 *
 * ```ts
 * const signer = new KeypairSigner(process.env.LP_SECRET_KEY!);
 * ```
 */
import { Keypair, SorobanRpc, Transaction } from "@stellar/stellar-sdk";
import type { ISigner } from "./ISigner.js";
/**
 * Server-side ISigner backed by a Stellar keypair.
 *
 * @example
 * ```ts
 * // From environment variable (recommended)
 * const signer = new KeypairSigner(process.env.LP_SECRET!);
 *
 * // From an existing Keypair instance
 * const kp = Keypair.fromSecret(process.env.LP_SECRET!);
 * const signer = new KeypairSigner(kp);
 *
 * // Sign a transaction
 * const signedXdr = await signer.signTransaction(tx, rpcServer);
 * ```
 */
export declare class KeypairSigner implements ISigner {
    private readonly _keypair;
    /**
     * @param keypairOrSecret - A `Keypair` instance **or** a Stellar secret key
     *   string starting with `S`. When a plain string is supplied outside of a
     *   test environment a security warning is emitted.
     */
    constructor(keypairOrSecret: Keypair | string);
    /** Stellar G… public key of this signer. */
    get publicKey(): string;
    /**
     * Simulate the transaction to obtain the Soroban footprint, sign the
     * prepared transaction, and return the signed XDR envelope as base-64.
     *
     * Steps:
     *   1. `server.prepareTransaction(tx)` — attaches footprint + auth entries.
     *   2. `preparedTx.sign(keypair)` — ECDSA/Ed25519 signature applied.
     *   3. Returns `preparedTx.toEnvelope().toXDR("base64")`.
     *
     * @param tx     - Unsigned transaction with at least one Soroban operation
     * @param server - Soroban RPC server used for simulation
     * @returns Signed base-64 XDR envelope ready for `server.sendTransaction()`
     *
     * @throws {Error} When Soroban simulation fails (contract error, bad auth,
     *   resource limit exceeded, etc.)
     */
    signTransaction(tx: Transaction, server: SorobanRpc.Server): Promise<string>;
    /**
     * Expose the underlying keypair for use-cases that need raw sign/verify
     * access (e.g. building multi-sig transactions).
     *
     * Treat the returned keypair as read-only; do not call `keypair.sign()`
     * directly on transaction envelopes — use `signTransaction()` so the
     * simulation step is always executed.
     */
    get keypair(): Keypair;
    /**
     * Create a KeypairSigner from a secret key stored in an environment
     * variable.
     *
     * ```ts
     * const signer = KeypairSigner.fromEnv("LP_SECRET_KEY");
     * ```
     *
     * @param envVar - Name of the environment variable holding the secret key
     * @throws {Error} When the environment variable is not set
     */
    static fromEnv(envVar: string): KeypairSigner;
}
