# ILN Governance Guide

Governance is only valuable if token holders understand how to participate. This guide explains how ILN governance works, how to earn voting power, and how to submit and vote on proposals.

## What is ILN governance and why it matters

ILN governance is the decentralized decision-making process that allows the community to shape the future of the protocol. It ensures that the network is guided by its users rather than a centralized entity.

This matters because it empowers those who use and support the protocol most—freelancers, businesses, and liquidity providers—to vote on critical changes. Through governance, you can help decide fee structures, parameter updates, supported assets, and new features, keeping ILN fair and continuously evolving.

## How to earn ILN tokens

ILN tokens represent your voting power in the protocol. You can earn them by actively participating in the network, such as by providing liquidity or actively submitting invoices.

For full details on token issuance and allocation, please refer to the [ILN Token Distribution Contract](../contracts/invoice_liquidity/src/distribution.rs) (or the relevant distribution documentation when deployed).

## How to create a proposal

Creating a governance proposal is the first step in proposing changes to the protocol.

**Step-by-step:**
1. Go to the **Governance** section in the ILN web app.
2. Click the **"Create Proposal"** button in the top right.
3. Fill out the proposal details:
   - **Title:** Provide a short, descriptive name for your proposal.
   - **Description:** Explain *why* you are making this proposal and the benefits it brings.
   - **Actions:** Define the specific technical parameters to be altered.
4. Click **"Submit Proposal"** and confirm the transaction via your wallet.

> ![Creating a Proposal](screenshots/create_proposal.png)
> *(Screenshot: Creating a governance proposal in the UI)*

## How to vote

If you hold ILN tokens, you have a say in active proposals.

**Step-by-step:**
1. Navigate to the **Governance** dashboard and click on **"Active Proposals"**.
2. Select the proposal you want to vote on to read its details.
3. In the voting panel on the right side, choose your stance: **"Vote For"**, **"Vote Against"**, or **"Abstain"**.
4. Click **"Cast Vote"** and approve the required transaction in your connected wallet.

> ![Voting on a Proposal](screenshots/vote_proposal.png)
> *(Screenshot: Casting a vote in the governance UI)*

## Proposal types explained

Proposals mostly fall into these straightforward categories:

- **Parameter Updates:** Small numeric changes to the protocol, such as adjusting the base discount rate, lowering withdrawal fees, or modifying quorum thresholds.
- **Protocol Upgrades (or Feature Additions):** Larger changes that might involve upgrading smart contracts or launching major new platform capabilities. 
- **Text Proposals:** Proposals used to gauge community interest or signal agreement on an issue without immediately executing any code changes.

## Quorum and majority rules

To maintain fairness and ensure high participation, voting is subject to the following rules:

- **Quorum:** This is the minimum amount of total voting power that must participate in a vote for it to be legally binding. If a vote doesn't meet the quorum threshold, it fails automatically, even if most of the votes are in favor.
- **Majority Rules:** For a proposal to pass (assuming quorum is met), more than 50% of the voting power cast must be strictly "For" the proposal.

## Timeline: From creation to execution

Governance moves carefully to ensure everyone has a chance to participate. The life of a proposal looks like this:

1. **Review Period:** Once submitted, there is a short waiting period before voting starts. This gives the community time to read and discuss the proposal.
2. **Voting Period:** The actively open window where token holders can vote. This typically lasts a few days.
3. **Execution Delay (Timelock):** If a proposal passes, it does not happen instantly. It enters a brief "timelock" delay, giving users a heads-up before the changes take effect.
4. **Execution:** After the delay, the proposal's code is executed on the blockchain!

## Past governance decisions

*This section serves as a historical record of community decisions.*

- *(Currently empty — no past governance decisions have been made yet!)*

