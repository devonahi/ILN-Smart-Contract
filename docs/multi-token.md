# Multi-Token Support (USDC, EURC, XLM)

## Overview

The Invoice Liquidity Network supports multi-token invoicing to enable global payments across different currencies on Stellar.

Instead of limiting invoices to a single asset, users can select a settlement token at the time of invoice creation.

This improves:
- Cross-border payment flexibility
- Stablecoin liquidity access
- Global freelancer payment experience

---

## Why Multi-Token Support Exists

In real-world freelance and invoice financing:

- Users operate in different currencies and regions
- Stablecoin availability varies by market
- Single-token systems create friction for global payments

This system solves this by supporting multiple Stellar-native and issued assets while keeping settlement rules strict and predictable.

---

## Supported Tokens

The system currently supports the following tokens:

| Token | Symbol | Type | Network |
|------|--------|------|---------|
| USD Coin | USDC | Stablecoin | Stellar |
| Euro Coin | EURC | Stablecoin | Stellar |
| Stellar Lumens | XLM | Native asset | Stellar |

> Note: USDC and EURC are issued assets on Stellar. XLM is the native network token and does not require an issuer.

---

## Important Token Rules

### 1. Token is locked at invoice creation

Once an invoice is created with a selected token:
- The token cannot be changed
- All payments must use the same token

---

### 2. No cross-token payments

Examples:
- USDC invoice ❌ cannot be paid in EURC
- EURC invoice ❌ cannot be paid in XLM

This ensures:
- predictable settlement
- no exchange-rate ambiguity
- simpler contract logic

---

### 3. Decimal handling

Different tokens use different decimal precision:

| Token | Decimals |
|------|----------|
| USDC | 6 |
| EURC | 6 |
| XLM | 7 |

All UI values should be normalized before display.

---

## Developer Guide

### Invoice creation (Soroban contract call)

Invoices are created by calling the contract with a selected token.

Example (Stellar CLI):

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- submit_invoice \
  --freelancer <FREELANCER_ADDRESS> \
  --payer <PAYER_ADDRESS> \
  --amount 100 \
  --due_date <UNIX_TIMESTAMP> \
  --discount_rate 500
```
> The token selection is handled at contract level based on supported asset configuration.

## How Token Integration Works
On Stellar:
- Tokens are represented as assets
- Each asset is identified by:
  - Code (e.g., USDC)
  - Issuer (for non-native tokens)

The contract logic enforces:
- validation of supported tokens
- correct settlement routing
- strict invoice-token binding

## Adding a New Token
To introduce a new supported token:

### 1. Update contract token enum
Add the token to the contract’s supported token list.

### 2. Configure asset validation
Define how the token is validated in invoice creation logic.

### 3. Update frontend selection UI
Add token option in invoice creation form.

### 4. Test on testnet
Ensure:
- invoice creation works
- funding works
- settlement behaves correctly

## FAQ
#### Can I pay a USDC invoice using EURC?
No.
Each invoice is locked to a single token at creation time to ensure predictable settlement.

#### Can I change token after invoice creation?
No. You must create a new invoice with the desired token.

#### Why not auto-convert tokens?
Automatic conversion introduces:
- oracle dependency risk
- inconsistent pricing
- added contract complexity

This system prioritizes deterministic settlement over automatic FX conversion.

## Summary
Multi-token support in this system enables global invoice financing while maintaining strict settlement guarantees.

Each invoice is token-locked at creation, ensuring clarity, auditability, and predictable liquidity behavior across the Stellar network.
