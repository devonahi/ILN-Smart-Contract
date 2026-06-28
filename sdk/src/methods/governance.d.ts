import { SorobanRpc, Account, Transaction } from "@stellar/stellar-sdk";
import { ProposalAction, type Proposal, type ProposalFilter, type CreateProposalResult } from "../types/governance.js";
/**
 * Create a new governance proposal.
 *
 * @param server Soroban RPC server
 * @param contractAddress Governance contract address
 * @param action The parameter-changing action to propose
 * @param proposedValue The proposed new value for the action's parameter
 * @param descriptionHash Hex-encoded 32-byte hash of the off-chain description
 * @param sourceAccount The proposer's account
 * @param signTransaction A function to sign the transaction
 * @param networkPassphrase The network passphrase
 * @returns The new proposalId and txHash
 * @throws {ILNError} When simulation or execution fails
 */
export declare function createProposal(server: SorobanRpc.Server, contractAddress: string, action: ProposalAction, proposedValue: bigint, descriptionHash: string, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<CreateProposalResult>;
/**
 * Cast a vote on an active proposal.
 *
 * @param support `true` to vote for, `false` to vote against.
 */
export declare function castVote(server: SorobanRpc.Server, contractAddress: string, proposalId: bigint, support: boolean, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<{
    txHash: string;
}>;
/**
 * Execute a proposal that has passed its vote.
 */
export declare function executeProposal(server: SorobanRpc.Server, contractAddress: string, proposalId: bigint, sourceAccount: Account, signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction, networkPassphrase: string): Promise<{
    txHash: string;
}>;
/**
 * Fetch a single proposal by ID (read-only; no signer required).
 */
export declare function getProposal(server: SorobanRpc.Server, contractAddress: string, id: bigint, sourceAccount: Account, networkPassphrase: string): Promise<Proposal>;
/**
 * List proposals, optionally filtered by status and/or proposer (read-only).
 */
export declare function listProposals(server: SorobanRpc.Server, contractAddress: string, sourceAccount: Account, networkPassphrase: string, filter?: ProposalFilter): Promise<Proposal[]>;
