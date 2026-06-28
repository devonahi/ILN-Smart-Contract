"use strict";
/**
 * ILNClient — entry point for the Invoice Liquidity Network SDK.
 *
 * Provides factory methods for common environments so integrators can
 * get started with a one-liner:
 *
 * ```ts
 * import { ILNClient } from "@iln/sdk";
 *
 * const client = ILNClient.testnet(signer);
 * const reputation = await client.getReputation("G...");
 * ```
 *
 * ## Architecture
 *
 * `ILNClient` is a thin wrapper around the SDK's free functions. It holds
 * the RPC server, network passphrase, contract address, and signer so
 * every method call uses the same configuration automatically.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.iln = exports.ILNClient = exports.MAINNET_RPC_URL = exports.TESTNET_RPC_URL = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
/**
 * Public Soroban RPC endpoint for Stellar Testnet.
 */
exports.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
/**
 * Public Soroban RPC endpoint for Stellar Mainnet (Pubnet).
 */
exports.MAINNET_RPC_URL = "https://soroban.stellar.org";
// ---------------------------------------------------------------------------
// ILNClient
// ---------------------------------------------------------------------------
/**
 * Configured SDK client bound to a specific network and contract.
 *
 * @example
 * ```ts
 * // Testnet
 * const client = ILNClient.testnet(mySigner);
 *
 * // Custom RPC (e.g. local validator node)
 * const client = ILNClient.custom({
 *   rpcUrl: "http://localhost:8000/soroban/rpc",
 *   networkPassphrase: Networks.STANDALONE,
 *   contractId: "CDEPLOYED...",
 *   signer: mySigner,
 * });
 * ```
 */
class ILNClient {
    constructor(config) {
        this.rpc = new stellar_sdk_1.SorobanRpc.Server(config.rpcUrl);
        this.networkPassphrase = config.networkPassphrase;
        this.contractId = config.contractId;
        this.signer = config.signer;
    }
    // --------------------------------------------------------------------------
    // Factory methods
    // --------------------------------------------------------------------------
    /**
     * Create a client pre-configured for Stellar Testnet.
     *
     * @param signer   - Optional signer for authenticated methods
     * @param options  - Override defaults (rpcUrl, contractId)
     *
     * @example
     * ```ts
     * const client = ILNClient.testnet(freighterSigner);
     * ```
     */
    static testnet(signer, options) {
        return new ILNClient({
            rpcUrl: options?.rpcUrl ?? exports.TESTNET_RPC_URL,
            networkPassphrase: "Test SDF Network ; September 2015",
            contractId: options?.contractId ??
                // Published testnet deployment: the canonical contract ID from
                // the latest testnet CI/CD deployment. Update here when redeploying.
                // TODO: replace with actual testnet contract ID once deployed
                "CD2Q6M76VFLHNHDNROENMX7PJ5OBYBMVPM73S4M6XAJXN3NKCBJQPLUC",
            signer,
        });
    }
    /**
     * Create a client pre-configured for Stellar Mainnet (Pubnet).
     *
     * @param signer   - Optional signer for authenticated methods
     * @param options  - Override defaults (rpcUrl, contractId)
     *
     * @example
     * ```ts
     * const client = ILNClient.mainnet(freighterSigner);
     * ```
     */
    static mainnet(signer, options) {
        // Future-proof: we allow configuring mainnet ahead of deployment
        // so integrators can test their integration code against the API shape.
        return new ILNClient({
            rpcUrl: options?.rpcUrl ?? exports.MAINNET_RPC_URL,
            networkPassphrase: "Public Global Stellar Network ; September 2015",
            contractId: options?.contractId ??
                // TODO: replace with actual mainnet contract ID after mainnet deployment
                "",
            signer,
        });
    }
    /**
     * Create a client with fully custom configuration.
     *
     * Use this for local development (standalone network), Futurenet, or
     * private Stellar deployments.
     *
     * @param config - Full ILNClientConfig
     */
    static custom(config) {
        return new ILNClient(config);
    }
    // --------------------------------------------------------------------------
    // Methods
    // --------------------------------------------------------------------------
    /**
     * Fetch the detailed reputation profile for an address.
     *
     * Read-only; does not require a signer.
     *
     * @param address - Stellar G… address to query
     * @returns ReputationProfile (zeroed for unknown addresses)
     */
    async getReputation(address) {
        if (!this._getReputation) {
            this._getReputation = (await Promise.resolve().then(() => __importStar(require("./methods/reputation.js"))))
                .getReputation;
        }
        return this._getReputation(this.rpc, this.contractId, address, this.networkPassphrase);
    }
    /**
     * Fetch protocol-wide statistics.
     *
     * Read-only; does not require a signer.
     *
     * @returns ContractStats
     */
    async getContractStats() {
        if (!this._getContractStats) {
            this._getContractStats = (await Promise.resolve().then(() => __importStar(require("./methods/stats.js"))))
                .getContractStats;
        }
        return this._getContractStats(this.rpc, this.contractId, this.networkPassphrase);
    }
}
exports.ILNClient = ILNClient;
// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
/**
 * Default ILNClient singleton.
 *
 * Must be initialised via `iln.configure(...)` before use.
 *
 * @example
 * ```ts
 * import { iln } from "@iln/sdk";
 *
 * iln.configure({ rpcUrl: "...", networkPassphrase: Networks.TESTNET, contractId: "..." });
 * await iln.getReputation("G...");
 * ```
 */
class ILNSingleton {
    constructor() {
        this._client = null;
    }
    configure(config) {
        this._client = new ILNClient(config);
    }
    /** Access the underlying client. Throws if not configured. */
    get client() {
        if (!this._client) {
            throw new Error("ILN singleton not configured. Call iln.configure({...}) first.");
        }
        return this._client;
    }
    async getReputation(address) {
        return this.client.getReputation(address);
    }
    async getContractStats() {
        return this.client.getContractStats();
    }
}
exports.iln = new ILNSingleton();
