"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProposal = createProposal;
exports.castVote = castVote;
exports.executeProposal = executeProposal;
exports.getProposal = getProposal;
exports.listProposals = listProposals;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_js_1 = require("../errors.js");
const governance_js_1 = require("../types/governance.js");
/**
 * Build, simulate, sign and submit a governance transaction, polling until the
 * network confirms it. Shared by the write methods below.
 */
async function sendGovernanceCall(server, sourceAccount, networkPassphrase, op, signTransaction) {
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
    const returnValue = status.status === stellar_sdk_1.SorobanRpc.Api.GetTransactionStatus.SUCCESS && status.returnValue
        ? (0, stellar_sdk_1.scValToNative)(status.returnValue)
        : undefined;
    return { txHash: sendResult.hash, returnValue };
}
/** Normalise a raw contract proposal record into a {@link Proposal}. */
function parseProposal(raw) {
    const statusTag = raw["status"]?.tag ?? String(raw["status"]);
    return {
        id: BigInt(String(raw["id"])),
        action: Number(raw["action"]),
        proposedValue: BigInt(String(raw["proposed_value"] ?? 0)),
        descriptionHash: raw["description_hash"]
            ? Buffer.from(raw["description_hash"]).toString("hex")
            : "",
        proposer: String(raw["proposer"]),
        votesFor: BigInt(String(raw["votes_for"] ?? 0)),
        votesAgainst: BigInt(String(raw["votes_against"] ?? 0)),
        status: governance_js_1.ProposalStatus[statusTag] ?? statusTag,
        votingEndsAt: Number(raw["voting_ends_at"] ?? 0),
    };
}
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
async function createProposal(server, contractAddress, action, proposedValue, descriptionHash, sourceAccount, signTransaction, networkPassphrase) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("create_proposal", (0, stellar_sdk_1.nativeToScVal)(sourceAccount.accountId(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(action, { type: "u32" }), (0, stellar_sdk_1.nativeToScVal)(proposedValue, { type: "i128" }), (0, stellar_sdk_1.nativeToScVal)(Buffer.from(descriptionHash, "hex"), { type: "bytes", size: 32 }));
    const { txHash, returnValue } = await sendGovernanceCall(server, sourceAccount, networkPassphrase, op, signTransaction);
    return {
        proposalId: returnValue !== undefined ? BigInt(String(returnValue)) : 0n,
        txHash,
    };
}
/**
 * Cast a vote on an active proposal.
 *
 * @param support `true` to vote for, `false` to vote against.
 */
async function castVote(server, contractAddress, proposalId, support, sourceAccount, signTransaction, networkPassphrase) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("cast_vote", (0, stellar_sdk_1.nativeToScVal)(sourceAccount.accountId(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }), (0, stellar_sdk_1.nativeToScVal)(support, { type: "bool" }));
    const { txHash } = await sendGovernanceCall(server, sourceAccount, networkPassphrase, op, signTransaction);
    return { txHash };
}
/**
 * Execute a proposal that has passed its vote.
 */
async function executeProposal(server, contractAddress, proposalId, sourceAccount, signTransaction, networkPassphrase) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("execute_proposal", (0, stellar_sdk_1.nativeToScVal)(sourceAccount.accountId(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }));
    const { txHash } = await sendGovernanceCall(server, sourceAccount, networkPassphrase, op, signTransaction);
    return { txHash };
}
/**
 * Fetch a single proposal by ID (read-only; no signer required).
 */
async function getProposal(server, contractAddress, id, sourceAccount, networkPassphrase) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("get_proposal", (0, stellar_sdk_1.nativeToScVal)(id, { type: "u64" }));
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
        throw new errors_js_1.ILNError(`Proposal ${id} not found`);
    }
    return parseProposal((0, stellar_sdk_1.scValToNative)(sim.result.retval));
}
/**
 * List proposals, optionally filtered by status and/or proposer (read-only).
 */
async function listProposals(server, contractAddress, sourceAccount, networkPassphrase, filter) {
    const contract = new stellar_sdk_1.Contract(contractAddress);
    const op = contract.call("list_proposals");
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
    let proposals = rawArr.map(parseProposal);
    if (filter?.status) {
        proposals = proposals.filter(p => p.status === filter.status);
    }
    if (filter?.proposer) {
        proposals = proposals.filter(p => p.proposer === filter.proposer);
    }
    return proposals;
}
