#![no_std]
// Soroban's contractimpl/contractargs macros generate client functions that
// mirror the contract's public interface — these may exceed the 7-argument
// threshold when the source function itself has many arguments.
#![allow(clippy::too_many_arguments)]

#[cfg(test)]
extern crate std;

pub mod access;
pub mod config;
pub mod constants;
pub mod errors;
pub mod events;
pub mod invoice;
pub mod oracle_interface;
pub mod rate_logic;
pub mod storage;
pub mod top_payers;

use access::*;
use soroban_sdk::{
    contract, contractimpl, token::Client as TokenClient, vec, Address, BytesN, Env, IntoVal,
    Symbol, Vec,
};

pub use crate::invoice::{
    AppealRecord, ContractStats, DisputeRecord, Invoice, InvoiceParams, InvoiceStatus,
    LpFundRequest, ReputationProfile, ReputationScore, StatsDelta, TopPayerEntry,
};
pub use crate::storage::DataKey as StorageKey;
pub use config::{Config, ConfigError};
pub use errors::ContractError;
pub use events::*;

use crate::storage::{
    get_admin, get_config, get_fund_queue, get_invoice_funders, get_min_payer_reputation,
    get_queue_resolution, is_paused, next_invoice_id, next_invoice_ids, read_next_invoice_id,
    save_fund_queue, save_invoice_funders, save_queue_resolution, set_config, set_min_payer_reputation,
    set_paused,
};

use crate::invoice::{
    add_invoice_to_lp, add_invoice_to_submitter, get_appeal, get_contract_stats, get_dispute,
    get_lp_invoices, get_lp_score, get_payer_score, get_pre_default_payer_score,
    get_reputation, get_submitter_invoices, increment_invoices_defaulted, increment_invoices_paid,
    increment_invoices_submitted, invoice_exists, load_invoice, remove_invoice_from_submitter,
    save_appeal, save_dispute, save_invoice, save_pre_default_payer_score, set_lp_score,
    set_payer_score, set_reputation, try_load_invoice,
};

// 30-day window in seconds for a payer to file an appeal after a default.
const APPEAL_WINDOW_SECONDS: u64 = 30 * 24 * 60 * 60;

// ----------------------------------------------------------------
// CONSTANTS (Legacy fallbacks, preferably use constants.rs)
// ----------------------------------------------------------------

/// Minimum invoice duration: 24 hours (in seconds)
const MIN_INVOICE_DURATION: u64 = 24 * 60 * 60;

/// Maximum invoice duration: 365 days (in seconds)
const MAX_INVOICE_DURATION: u64 = 365 * 24 * 60 * 60;

// ----------------------------------------------------------------
// CONTRACT
// ----------------------------------------------------------------

#[contract]
pub struct InvoiceLiquidityContract;

#[contractimpl]
impl InvoiceLiquidityContract {
    // ------------------------------------------------------------
    // initialize (multi-token aware)
    // ------------------------------------------------------------
    /// Access: Anyone
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        xlm_token: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&StorageKey::Admin) || 
           env.storage().instance().has(&StorageKey::InvoiceCount) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&StorageKey::Admin, &admin);
        env.storage().instance().set(&StorageKey::FeeRate, &0_u32);
        env.storage()
            .instance()
            .set(&StorageKey::MaxDiscountRate, &5000_u32);

        if !env.storage().instance().has(&StorageKey::NextInvoiceId) {
            env.storage().instance().set(&StorageKey::NextInvoiceId, &1_u64);
        }

        // Initialize config
        let initial_config = Config {
            high_rep_threshold: 70,
            bonus_bps: 100,
            min_discount_rate_bps: 100,
            decay_rate_bps: 50,
            decay_period_ledgers: 10000,
            dispute_timeout_ledgers: 10000,
            xlm_sac_address: xlm_token.clone(),
            price_oracle: None,
        };
        set_config(&env, &initial_config);

        // approve first token
        env.storage()
            .persistent()
            .set(&StorageKey::ApprovedToken(token.clone()), &true);

        // approve native XLM SAC
        env.storage()
            .persistent()
            .set(&StorageKey::ApprovedToken(xlm_token.clone()), &true);

        let mut list: Vec<Address> = Vec::new(&env);
        list.push_back(token.clone());
        list.push_back(xlm_token.clone());

        env.storage()
            .persistent()
            .set(&StorageKey::TokenList, &list);

        Ok(())
    }

    pub fn get_config(env: Env) -> Result<Config, ContractError> {
        crate::storage::get_config(&env).ok_or(ContractError::Unauthorized)
    }

    pub fn update_config(
        env: Env,
        caller: Address,
        high_rep_threshold: u32,
        bonus_bps: u32,
        min_discount_rate_bps: u32,
        decay_rate_bps: u32,
        decay_period_ledgers: u64,
        dispute_timeout_ledgers: u64,
        xlm_sac_address: Address,
    ) -> Result<(), ContractError> {
        crate::config::update_config(
            &env,
            &caller,
            high_rep_threshold,
            bonus_bps,
            min_discount_rate_bps,
            decay_rate_bps,
            decay_period_ledgers,
            dispute_timeout_ledgers,
            xlm_sac_address,
        )
        .map_err(|_| ContractError::Unauthorized)
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        let old_admin: Address = env.storage().instance().get(&StorageKey::Admin).unwrap();
        env.storage().instance().set(&StorageKey::Admin, &new_admin);
        env.events().publish_event(&AdminChanged {
            old_admin,
            new_admin,
            timestamp: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn update_fee_rate(env: Env, rate: u32) -> Result<(), ContractError> {
        require_admin(&env)?;
        let old_rate: u32 = env.storage().instance().get(&StorageKey::FeeRate).unwrap_or(0);
        env.storage().instance().set(&StorageKey::FeeRate, &rate);
        let updated_by = get_admin(&env).ok_or(ContractError::Unauthorized)?;
        env.events().publish_event(&ParameterUpdated {
            param_name: Symbol::new(&env, "protocol_fee_rate_bps"),
            old_value: old_rate as i128,
            new_value: rate as i128,
            updated_by,
        });
        Ok(())
    }

    pub fn update_max_discount(env: Env, rate: u32) -> Result<(), ContractError> {
        require_admin(&env)?;
        let old_rate: u32 = env
            .storage()
            .instance()
            .get(&StorageKey::MaxDiscountRate)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&StorageKey::MaxDiscountRate, &rate);
        let updated_by = get_admin(&env).ok_or(ContractError::Unauthorized)?;
        env.events().publish_event(&ParameterUpdated {
            param_name: Symbol::new(&env, "max_discount_rate_bps"),
            old_value: old_rate as i128,
            new_value: rate as i128,
            updated_by,
        });
        Ok(())
    }

    pub fn set_distribution_contract(
        env: Env,
        distribution_contract: Address,
    ) -> Result<(), ContractError> {
        require_admin(&env)?;
        env.storage()
            .instance()
            .set(&StorageKey::DistributionContract, &distribution_contract);
        Ok(())
    }

    pub fn set_price_oracle(env: Env, oracle: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        let admin = get_admin(&env).ok_or(ContractError::Unauthorized)?;
        crate::config::set_price_oracle(&env, &admin, oracle)
            .map_err(|_| ContractError::Unauthorized)?;
        Ok(())
    }

    pub fn get_price_oracle(env: Env) -> Option<Address> {
        get_config(&env).and_then(|config| config.price_oracle)
    }

    pub fn add_token(env: Env, token: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        env.storage()
            .persistent()
            .set(&StorageKey::ApprovedToken(token.clone()), &true);

        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKey::TokenList)
            .unwrap_or(Vec::new(&env));
        if !list.contains(&token) {
            list.push_back(token.clone());
            env.storage().persistent().set(&StorageKey::TokenList, &list);
        }

        env.events().publish_event(&TokenAdded { token });
        Ok(())
    }

    pub fn remove_token(env: Env, token: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        env.storage()
            .persistent()
            .set(&StorageKey::ApprovedToken(token.clone()), &false);

        let list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKey::TokenList)
            .unwrap_or(Vec::new(&env));
        let mut pruned: Vec<Address> = Vec::new(&env);
        for t in list.iter() {
            if t != token {
                pruned.push_back(t);
            }
        }
        env.storage()
            .persistent()
            .set(&StorageKey::TokenList, &pruned);

        env.events().publish_event(&TokenRemoved { token });
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), ContractError> {
        require_admin(&env)?;
        set_paused(&env, true);
        env.events().publish_event(&ContractPaused {
            timestamp: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), ContractError> {
        require_admin(&env)?;
        set_paused(&env, false);
        env.events().publish_event(&ContractUnpaused {
            timestamp: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        require_admin(&env)?;
        let admin = get_admin(&env).ok_or(ContractError::Unauthorized)?;
        env.events().publish_event(&ContractUpgraded {
            admin,
            new_wasm_hash,
            timestamp: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn get_contract_stats(env: Env) -> ContractStats {
        invoice::get_contract_stats(&env)
    }

    pub fn list_invoices_by_submitter(
        env: Env,
        submitter: Address,
        page: u32,
        page_size: u32,
    ) -> Vec<Invoice> {
        let page_size = page_size.min(50);
        let invoice_ids = get_submitter_invoices(&env, &submitter);
        let total = invoice_ids.len();
        let start = page * page_size;
        if start >= total {
            return Vec::new(&env);
        }
        let end = (start + page_size).min(total);
        let mut result = Vec::new(&env);
        for i in start..end {
            if let Some(id) = invoice_ids.get(i) {
                result.push_back(load_invoice(&env, id));
            }
        }
        result
    }

    pub fn list_invoices_by_lp(env: Env, lp: Address, page: u32, page_size: u32) -> Vec<Invoice> {
        let page_size = page_size.min(50);
        let invoice_ids = get_lp_invoices(&env, &lp);
        let total = invoice_ids.len();
        let start = page * page_size;
        if start >= total {
            return Vec::new(&env);
        }
        let end = (start + page_size).min(total);
        let mut result = Vec::new(&env);
        for i in start..end {
            if let Some(id) = invoice_ids.get(i) {
                result.push_back(load_invoice(&env, id));
            }
        }
        result
    }

    pub fn submit_invoice(
        env: Env,
        freelancer: Address,
        payer: Address,
        amount: i128,
        due_date: u64,
        discount_rate: u32,
        token: Address,
    ) -> Result<u64, ContractError> {
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        require_submitter(&env, &freelancer)?;
        if freelancer == payer {
            return Err(ContractError::SelfInvoice);
        }
        validate_invoice_terms(&env, amount, due_date, discount_rate)?;
        if !is_approved_token(&env, &token) {
            return Err(ContractError::Unauthorized);
        }

        let id = next_invoice_id(&env)?;
        let submitter_reputation = get_payer_score(&env, &freelancer);

        let invoice = Invoice {
            id,
            freelancer: freelancer.clone(),
            payer: payer.clone(),
            token: token.clone(),
            amount,
            due_date: due_date.try_into().unwrap(),
            discount_rate,
            status: InvoiceStatus::Pending,
            funder: None,
            funded_at: None,
            amount_funded: 0,
            amount_paid: 0,
            submitter_reputation,
        };

        save_invoice(&env, &invoice);
        add_invoice_to_submitter(&env, &freelancer, id);

        // Increment detailed reputation invoices_submitted count
        increment_invoices_submitted(&env, &freelancer);

        // OPTIMIZATION: Batch stat update
        let mut stats_delta = StatsDelta::default();
        stats_delta.total_invoices = 1;
        stats_delta.apply(&env);

        env.events().publish_event(&InvoiceSubmitted {
            invoice_id: id,
            freelancer,
            payer: invoice.payer,
            token: invoice.token,
            amount,
            due_date: u64::from(invoice.due_date),
            discount_rate,
            status: invoice.status,
            timestamp: env.ledger().timestamp(),
        });
        Ok(id)
        }

        pub fn update_invoice(
        env: Env,
        freelancer: Address,
        invoice_id: u64,
        amount: i128,
        due_date: u64,
        discount_rate: u32,
        ) -> Result<(), ContractError> {
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }

        if !invoice_exists(&env, invoice_id) {
            return Err(ContractError::InvoiceNotFound);
        }

        let mut invoice = load_invoice(&env, invoice_id);
        require_submitter_by_id(&env, &freelancer, invoice_id)?;

        if invoice.status == InvoiceStatus::Pending
            && env.ledger().timestamp() >= u64::from(invoice.due_date)
        {
            invoice.status = InvoiceStatus::Expired;
            save_invoice(&env, &invoice);
            return Err(ContractError::InvoiceExpired);
        }

        match invoice.status {
            InvoiceStatus::Pending => {}
            InvoiceStatus::PartiallyFunded | InvoiceStatus::Funded => {
                return Err(ContractError::AlreadyFunded)
            }
            InvoiceStatus::Paid => return Err(ContractError::AlreadyPaid),
            InvoiceStatus::Defaulted => return Err(ContractError::InvoiceDefaulted),
            InvoiceStatus::Appealed => return Err(ContractError::InvoiceAppealed),
            InvoiceStatus::Disputed => return Err(ContractError::InvoiceDisputed),
            InvoiceStatus::Expired => return Err(ContractError::InvoiceExpired),
            InvoiceStatus::Cancelled => return Err(ContractError::AlreadyCancelled),
        }

        validate_invoice_terms(&env, amount, due_date, discount_rate)?;

        invoice.amount = amount;
        invoice.due_date = due_date.try_into().unwrap();
        invoice.discount_rate = discount_rate;

        save_invoice(&env, &invoice);

        env.events().publish_event(&InvoiceUpdated {
            invoice_id: invoice.id,
            freelancer: invoice.freelancer.clone(),
            payer: invoice.payer.clone(),
            token: invoice.token.clone(),
            amount: invoice.amount,
            due_date: u64::from(invoice.due_date),
            discount_rate: invoice.discount_rate,
            status: invoice.status.clone(),
        });

        Ok(())
        }


    pub fn submit_invoices_batch(
        env: Env,
        invoices: Vec<InvoiceParams>,
    ) -> Result<Vec<u64>, ContractError> {
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        if invoices.len() > 10 {
            return Err(ContractError::BatchTooLarge);
        }

        let mut authenticated_freelancers: Vec<Address> = Vec::new(&env);
        let mut ids = Vec::new(&env);
        let mut stats_delta = StatsDelta::default();

        // OPTIMIZATION: Batch ID generation
        let mut next_id = next_invoice_ids(&env, invoices.len())?;

        for params in invoices.iter() {
            if !authenticated_freelancers.contains(&params.freelancer) {
                require_submitter(&env, &params.freelancer)?;
                authenticated_freelancers.push_back(params.freelancer.clone());
            }
            validate_invoice_terms(&env, params.amount, params.due_date, params.discount_rate)?;
            if !is_approved_token(&env, &params.token) {
                return Err(ContractError::Unauthorized);
            }

            let id = next_id;
            next_id += 1;

            let submitter_reputation = get_payer_score(&env, &params.freelancer);
            let invoice = Invoice {
                id,
                freelancer: params.freelancer.clone(),
                payer: params.payer.clone(),
                token: params.token.clone(),
                amount: params.amount,
                due_date: params.due_date.try_into().unwrap(),
                discount_rate: params.discount_rate,
                status: InvoiceStatus::Pending,
                funder: None,
                funded_at: None,
                amount_funded: 0,
                amount_paid: 0,
                submitter_reputation,
            };

            save_invoice(&env, &invoice);
            add_invoice_to_submitter(&env, &params.freelancer, id);
            
            // Increment detailed reputation invoices_submitted count
            increment_invoices_submitted(&env, &params.freelancer);

            stats_delta.total_invoices += 1;

            env.events().publish_event(&InvoiceSubmitted {
                invoice_id: id,
                freelancer: params.freelancer,
                payer: invoice.payer,
                token: invoice.token,
                amount: invoice.amount,
                due_date: u64::from(invoice.due_date),
                discount_rate: invoice.discount_rate,
                status: invoice.status,
                timestamp: env.ledger().timestamp(),
            });
            ids.push_back(id);
        }

        // OPTIMIZATION: Apply all stat changes in one write
        stats_delta.apply(&env);
        Ok(ids)
    }

    pub fn fund_invoice(
        env: Env,
        funder: Address,
        invoice_id: u64,
        fund_amount: i128,
    ) -> Result<(), ContractError> {
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        require_lp(&env, &funder)?;

        let mut invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;

        if let Some(approved) = get_queue_resolution(&env, invoice_id) {
            if approved != funder {
                return Err(ContractError::NotApprovedFunder);
            }
        }

        if !is_approved_token(&env, &invoice.token) {
            return Err(ContractError::Unauthorized);
        }

        let min_rep = get_min_payer_reputation(&env);
        if min_rep > 0 && get_payer_score(&env, &invoice.payer) < min_rep {
            return Err(ContractError::PayerReputationTooLow);
        }

        if invoice.status == InvoiceStatus::Pending && env.ledger().timestamp() >= u64::from(invoice.due_date) {
            invoice.status = InvoiceStatus::Expired;
            save_invoice(&env, &invoice);
            env.events().publish_event(&InvoiceExpired {
                invoice_id: invoice.id,
                freelancer: invoice.freelancer.clone(),
                status: invoice.status.clone(),
            });
            return Err(ContractError::InvoiceExpired);
        }

        match invoice.status {
            InvoiceStatus::Pending | InvoiceStatus::PartiallyFunded => {}
            InvoiceStatus::Paid => return Err(ContractError::AlreadyPaid),
            InvoiceStatus::Defaulted => return Err(ContractError::InvoiceDefaulted),
            InvoiceStatus::Appealed => return Err(ContractError::InvoiceAppealed),
            InvoiceStatus::Disputed => return Err(ContractError::InvoiceDisputed),
            InvoiceStatus::Expired => return Err(ContractError::InvoiceExpired),
            InvoiceStatus::Funded => return Err(ContractError::AlreadyFunded),
            InvoiceStatus::Cancelled => return Err(ContractError::AlreadyCancelled),
        }

        if invoice.amount_funded + fund_amount > invoice.amount {
            return Err(ContractError::OverfundingRejected);
        }

        let token = token_client(&env, &invoice.token);
        let contract_address = env.current_contract_address();

        let normalized_fund_amount = if is_xlm_token(&env, &invoice.token) {
            normalize_xlm_amount(fund_amount)
        } else {
            normalize_usdc_amount(fund_amount)
        };

        let fund_discount = normalized_fund_amount
            .checked_mul(discount_rate_as_i128(invoice.discount_rate))
            .unwrap_or(0) / 10_000;
        let cost = normalized_fund_amount - fund_discount;

        token.transfer(&funder, &contract_address, &cost);

        let mut funders = get_invoice_funders(&env, invoice_id);
        let mut found = false;
        for i in 0..funders.len() {
            let (addr, amt) = funders.get(i).unwrap();
            if addr == funder {
                funders.set(i, (addr, amt + fund_amount));
                found = true;
                break;
            }
        }
        if !found {
            funders.push_back((funder.clone(), fund_amount));
        }
        save_invoice_funders(&env, invoice_id, &funders);

        invoice.amount_funded += fund_amount;

        if invoice.amount_funded == invoice.amount {
            let discount_amount = invoice.amount.checked_mul(discount_rate_as_i128(invoice.discount_rate)).unwrap_or(0) / 10_000;
            let freelancer_payout = invoice.amount - discount_amount;
            token.transfer(&contract_address, &invoice.freelancer, &freelancer_payout);
            invoice.status = InvoiceStatus::Funded;
            invoice.funded_at = Some(env.ledger().timestamp().try_into().unwrap());
            invoice.funder = Some(funder.clone());
            set_lp_score(&env, &funder, get_lp_score(&env, &funder) + 1);
        } else {
            invoice.status = InvoiceStatus::PartiallyFunded;
        }

        save_invoice(&env, &invoice);
        add_invoice_to_lp(&env, &funder, invoice_id);

        // OPTIMIZATION: Batch stat updates
        let mut stats_delta = StatsDelta::default();
        if invoice.status == InvoiceStatus::Funded {
            stats_delta.total_funded = 1;
        }

        stats_delta.add_volume(&env, &invoice.token, fund_amount);
        stats_delta.apply(&env);

        notify_distribution_funding(&env, &funder, fund_amount);

        let now = env.ledger().timestamp();
        let days_to_due = if u64::from(invoice.due_date) > now { (u64::from(invoice.due_date) - now) / (24*60*60) } else { 0 };
        let effective_yield_bps = ((invoice.discount_rate as u64 * days_to_due) / 365) as u32;

        env.events().publish_event(&InvoiceFunded {
            invoice_id,
            funder: funder.clone(),
            freelancer: invoice.freelancer,
            payer: invoice.payer,
            token: invoice.token,
            fund_amount,
            amount_funded: invoice.amount_funded,
            invoice_amount: invoice.amount,
            due_date: u64::from(invoice.due_date),
            discount_rate: invoice.discount_rate,
            funded_at: invoice.funded_at.map(|ts| ts.into()),
            status: invoice.status,
            lp: funder,
            effective_yield_bps,
            timestamp: now,
        });
        Ok(())
    }

    pub fn expire_invoice(env: Env, invoice_id: u64) -> Result<(), ContractError> {
        if !invoice_exists(&env, invoice_id) {
            return Err(ContractError::InvoiceNotFound);
        }

        let mut invoice = load_invoice(&env, invoice_id);

        if env.ledger().timestamp() < u64::from(invoice.due_date) {
            return Err(ContractError::NotYetDefaulted);
        }

        match invoice.status {
            InvoiceStatus::Pending => {
                invoice.status = InvoiceStatus::Expired;
                save_invoice(&env, &invoice);
                env.events().publish_event(&InvoiceExpired {
                    invoice_id,
                    freelancer: invoice.freelancer,
                    status: invoice.status,
                });
                Ok(())
            }
            _ => Err(ContractError::Unauthorized),
        }
    }

    pub fn mark_paid(env: Env, invoice_id: u64, amount: i128) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        if amount <= 0 { return Err(ContractError::InvalidAmount); }

        let mut invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        require_payer_by_id(&env, invoice_id)?;

        match invoice.status {
            InvoiceStatus::Funded => {}
            InvoiceStatus::Paid => return Err(ContractError::AlreadyPaid),
            InvoiceStatus::Defaulted => return Err(ContractError::InvoiceDefaulted),
            InvoiceStatus::Appealed => return Err(ContractError::InvoiceAppealed),
            InvoiceStatus::Disputed => return Err(ContractError::InvoiceDisputed),
            InvoiceStatus::Expired => return Err(ContractError::InvoiceExpired),
            InvoiceStatus::Cancelled => return Err(ContractError::AlreadyCancelled),
            InvoiceStatus::Pending | InvoiceStatus::PartiallyFunded => return Err(ContractError::NotFunded),
        }

        let remaining = invoice.amount - invoice.amount_paid;
        if amount > remaining { return Err(ContractError::OverpaymentRejected); }

        let funders = get_invoice_funders(&env, invoice_id);
        if funders.is_empty() { return Err(ContractError::NotFunded); }

        let token = token_client(&env, &invoice.token);
        let contract_address = env.current_contract_address();

        let normalized_amount = if is_xlm_token(&env, &invoice.token) { normalize_xlm_amount(amount) } else { normalize_usdc_amount(amount) };
        token.transfer(&invoice.payer, &contract_address, &normalized_amount);

        invoice.amount_paid += amount;

        if invoice.amount_paid < invoice.amount {
            save_invoice(&env, &invoice);
            env.events().publish_event(&InvoicePartiallyPaid {
                invoice_id,
                payer: invoice.payer,
                amount_paid_now: amount,
                total_amount_paid: invoice.amount_paid,
                remaining_amount: invoice.amount - invoice.amount_paid,
            });
            return Ok(());
        }

        let fee_rate: u32 = env.storage().instance().get(&StorageKey::FeeRate).unwrap_or(0);
        let protocol_fee = invoice.amount.checked_mul(fee_rate as i128).unwrap_or(0) / 10_000;
        if protocol_fee > 0 {
            let admin: Address = env.storage().instance().get(&StorageKey::Admin).unwrap();
            token.transfer(&contract_address, &admin, &protocol_fee);
        }

        let distribute_amount = invoice.amount - protocol_fee;
        
        let primary_lp = funders.get(0).unwrap().0.clone();
        let primary_lp_funded = funders.get(0).unwrap().1;
        let primary_lp_payout = distribute_amount.checked_mul(primary_lp_funded).unwrap_or(0) / invoice.amount;
        let lp_earned = primary_lp_payout - primary_lp_funded;

        for i in 0..funders.len() {
            let (addr, amt) = funders.get(i).unwrap();
            let share = distribute_amount.checked_mul(amt).unwrap_or(0) / invoice.amount;
            if share > 0 { token.transfer(&contract_address, &addr, &share); }
        }

        invoice.status = InvoiceStatus::Paid;
        save_invoice(&env, &invoice);

        // OPTIMIZATION: Batch stat update
        let mut stats_delta = StatsDelta::default();
        stats_delta.total_paid = 1;
        stats_delta.apply(&env);

        let paid_on_time = env.ledger().timestamp() <= u64::from(invoice.due_date);
        notify_distribution_settlement(&env, &invoice.freelancer, &invoice.payer, paid_on_time);
        
        // Update payer reputation
        let current_score = get_payer_score(&env, &invoice.payer);
        set_payer_score(&env, &invoice.payer, current_score + 1);

        // Increment detailed reputation invoices_paid count for both payer and freelancer
        increment_invoices_paid(&env, &invoice.payer);
        increment_invoices_paid(&env, &invoice.freelancer);

        env.events().publish_event(&InvoicePaid {
            invoice_id,
            payer: invoice.payer,
            lp: primary_lp,
            freelancer: invoice.freelancer,
            token: invoice.token,
            amount_paid: invoice.amount,
            lp_earned,
            lp_payout: primary_lp_payout,
            settlement_timestamp: env.ledger().timestamp(),
            paid_on_time,
            status: invoice.status,
        });
        Ok(())
    }

    pub fn claim_yield(env: Env, invoice_id: u64) -> Result<i128, ContractError> {
        let invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        if let Some(ref funder) = invoice.funder {
            require_lp_by_id(&env, funder, invoice_id)?;
        } else {
            return Err(ContractError::NothingToClaim);
        }

        match invoice.status {
            InvoiceStatus::Paid => {
                let yield_amount = invoice.amount.checked_mul(discount_rate_as_i128(invoice.discount_rate)).unwrap_or(0) / 10_000;
                Ok(yield_amount)
            }
            _ => Ok(0),
        }
    }

    pub fn claim_default(env: Env, funder: Address, invoice_id: u64) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        require_lp(&env, &funder)?;
        
        let mut invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;

        let funders = get_invoice_funders(&env, invoice_id);
        if !funders.iter().any(|f| f.0 == funder) {
            return Err(ContractError::Unauthorized);
        }

        if env.ledger().timestamp() < u64::from(invoice.due_date) {
            return Err(ContractError::NotYetDefaulted);
        }

        match invoice.status {
            InvoiceStatus::Funded => {}
            InvoiceStatus::Paid => return Err(ContractError::AlreadyPaid),
            InvoiceStatus::Defaulted => return Err(ContractError::InvoiceDefaulted),
            _ => return Err(ContractError::NotFunded),
        }

        let token = token_client(&env, &invoice.token);
        let contract_address = env.current_contract_address();
        let mut total_refunded = 0;
        for i in 0..funders.len() {
            let (addr, amt) = funders.get(i).unwrap();
            let refund = amt - (amt * invoice.discount_rate as i128 / 10_000);
            
            // NOTE: This will fail if contract doesn't have balance. 
            // In a real scenario, this might be handled by a pool or insurance.
            token.transfer(&contract_address, &addr, &refund);
            total_refunded += refund;
        }

        invoice.status = InvoiceStatus::Defaulted;
        save_invoice(&env, &invoice);

        let current_score = get_payer_score(&env, &invoice.payer);
        save_pre_default_payer_score(&env, invoice_id, current_score);
        set_payer_score(&env, &invoice.payer, current_score.saturating_sub(5));
        
        // Increment detailed reputation invoices_defaulted count for the payer
        increment_invoices_defaulted(&env, &invoice.payer);

        env.events().publish_event(&InvoiceDefaulted {
            invoice_id,
            funder,
            freelancer: invoice.freelancer,
            payer: invoice.payer,
            token: invoice.token,
            amount: invoice.amount,
            due_date: u64::from(invoice.due_date),
            defaulted_at: env.ledger().timestamp(),
            discount_amount: total_refunded,
            status: invoice.status,
        });
        Ok(())
    }

    pub fn appeal_default(env: Env, invoice_id: u64, evidence_hash: BytesN<32>) -> Result<(), ContractError> {
        let mut invoice = load_invoice(&env, invoice_id);
        require_payer_by_id(&env, invoice_id)?;
        if get_appeal(&env, invoice_id).is_some() { return Err(ContractError::AlreadyAppealed); }
        if invoice.status != InvoiceStatus::Defaulted { return Err(ContractError::NotDefaulted); }

        let now = env.ledger().timestamp();
        if now > u64::from(invoice.due_date) + APPEAL_WINDOW_SECONDS {
            return Err(ContractError::AppealWindowClosed);
        }

        save_appeal(&env, invoice_id, &AppealRecord {
            evidence_hash: evidence_hash.clone(),
            appealed_at: now.try_into().unwrap(),
            pre_default_score: get_pre_default_payer_score(&env, invoice_id).unwrap_or(50),
        });

        invoice.status = InvoiceStatus::Appealed;
        save_invoice(&env, &invoice);

        env.events().publish_event(&DefaultAppealed {
            invoice_id,
            payer: invoice.payer,
            evidence_hash,
            appealed_at: now,
        });
        Ok(())
    }

    pub fn resolve_appeal(env: Env, invoice_id: u64, upheld: bool) -> Result<(), ContractError> {
        require_admin(&env)?;
        let mut invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        if invoice.status != InvoiceStatus::Appealed { return Err(ContractError::NotDefaulted); }
        let appeal = get_appeal(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;

        if upheld {
            set_payer_score(&env, &invoice.payer, appeal.pre_default_score);
            
            // Decrement invoices_defaulted count
            let mut profile = get_reputation(&env, &invoice.payer);
            profile.invoices_defaulted = profile.invoices_defaulted.saturating_sub(1);
            set_reputation(&env, &profile);
        }
        invoice.status = InvoiceStatus::Defaulted;
        save_invoice(&env, &invoice);

        env.events().publish_event(&AppealResolved {
            invoice_id,
            payer: invoice.payer,
            upheld,
            resolved_at: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn dispute_invoice(env: Env, invoice_id: u64, reason_hash: BytesN<32>) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        let mut invoice = load_invoice(&env, invoice_id);
        require_payer_by_id(&env, invoice_id)?;
        if get_dispute(&env, invoice_id).is_some() { return Err(ContractError::AlreadyDisputed); }

        match invoice.status {
            InvoiceStatus::Pending | InvoiceStatus::PartiallyFunded | InvoiceStatus::Funded => {}
            _ => return Err(ContractError::Unauthorized),
        }

        save_dispute(&env, invoice_id, &DisputeRecord {
            reason_hash: reason_hash.clone(),
            disputed_at: env.ledger().sequence(),
        });

        invoice.status = InvoiceStatus::Disputed;
        save_invoice(&env, &invoice);

        env.events().publish_event(&InvoiceDisputed {
            invoice_id,
            payer: invoice.payer,
            reason_hash,
            disputed_at: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn resolve_dispute(env: Env, invoice_id: u64, resolution_hash: BytesN<32>, resolution: u32) -> Result<(), ContractError> {
        require_admin(&env)?;
        let mut invoice = load_invoice(&env, invoice_id);
        if invoice.status != InvoiceStatus::Disputed { return Err(ContractError::NotDisputed); }

        match resolution {
            1 => { // Upheld (Payer)
                let funders = get_invoice_funders(&env, invoice_id);
                let token = token_client(&env, &invoice.token);
                let contract_address = env.current_contract_address();
                for i in 0..funders.len() {
                    let (addr, amt) = funders.get(i).unwrap();
                    let refund = amt - (amt * invoice.discount_rate as i128 / 10_000);
                    token.transfer(&contract_address, &addr, &refund);
                }
                invoice.status = InvoiceStatus::Cancelled;
            }
            2 => { // Rejected (Freelancer)
                if invoice.amount_funded == invoice.amount { invoice.status = InvoiceStatus::Funded; }
                else if invoice.amount_funded > 0 { invoice.status = InvoiceStatus::PartiallyFunded; }
                else { invoice.status = InvoiceStatus::Pending; }
            }
            _ => return Err(ContractError::Unauthorized),
        }

        save_invoice(&env, &invoice);
        env.events().publish_event(&DisputeResolved {
            invoice_id,
            resolution_hash,
            resolution,
            resolved_at: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn auto_resolve_dispute(env: Env, invoice_id: u64) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        let mut invoice = load_invoice(&env, invoice_id);
        if invoice.status != InvoiceStatus::Disputed { return Err(ContractError::NotDisputed); }
        let dispute = get_dispute(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        let config = get_config(&env).ok_or(ContractError::Unauthorized)?;
        
        if (env.ledger().sequence() as u64) < (dispute.disputed_at as u64) + config.dispute_timeout_ledgers {
             return Err(ContractError::Unauthorized);
        }

        if invoice.amount_funded == invoice.amount { invoice.status = InvoiceStatus::Funded; }
        else if invoice.amount_funded > 0 { invoice.status = InvoiceStatus::PartiallyFunded; }
        else { invoice.status = InvoiceStatus::Pending; }

        save_invoice(&env, &invoice);
        
        env.events().publish_event(&DisputeResolved {
            invoice_id,
            resolution_hash: BytesN::from_array(&env, &[0u8; 32]),
            resolution: 2, // Rejected
            resolved_at: env.ledger().timestamp(),
        });
        Ok(())
    }

    pub fn payer_score(env: Env, payer: Address) -> u32 { get_payer_score(&env, &payer) }
    pub fn lp_score(env: Env, lp: Address) -> u32 { get_lp_score(&env, &lp) }
    pub fn get_reputation(env: Env, address: Address) -> ReputationProfile { invoice::get_reputation(&env, &address) }
    pub fn min_payer_reputation(env: Env) -> u32 { get_min_payer_reputation(&env) }
    pub fn set_min_payer_reputation(env: Env, value: u32) -> Result<(), ContractError> {
        require_admin(&env)?;
        let updated_by = get_admin(&env).ok_or(ContractError::Unauthorized)?;
        let old_value = get_min_payer_reputation(&env);
        set_min_payer_reputation(&env, value);
        env.events().publish_event(&ParameterUpdated {
            param_name: Symbol::new(&env, "min_payer_reputation"),
            old_value: old_value as i128,
            new_value: value as i128,
            updated_by,
        });
        Ok(())
    }

    pub fn get_invoice(env: Env, invoice_id: u64) -> Result<Invoice, ContractError> {
        try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)
    }

    pub fn get_invoice_count(env: Env) -> u64 { read_next_invoice_id(&env) - 1 }

    pub fn cancel_invoice(env: Env, invoice_id: u64) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        let mut invoice = load_invoice(&env, invoice_id);
        require_submitter_by_id(&env, &invoice.freelancer, invoice_id)?;
        
        match invoice.status {
            InvoiceStatus::Pending => {}
            InvoiceStatus::PartiallyFunded => {
                let funders = get_invoice_funders(&env, invoice_id);
                let token = token_client(&env, &invoice.token);
                let contract_address = env.current_contract_address();
                for i in 0..funders.len() {
                    let (funder_addr, fund_amt) = funders.get(i).unwrap();
                    let fund_discount = fund_amt.checked_mul(discount_rate_as_i128(invoice.discount_rate)).unwrap_or(0) / 10_000;
                    let refund = fund_amt - fund_discount;
                    token.transfer(&contract_address, &funder_addr, &refund);
                }
            }
            _ => return Err(ContractError::AlreadyFunded),
        }
        
        invoice.status = InvoiceStatus::Cancelled;
        save_invoice(&env, &invoice);
        
        env.events().publish_event(&InvoiceCancelled {
            invoice_id,
            freelancer: invoice.freelancer,
            status: invoice.status,
        });
        Ok(())
    }

    pub fn join_fund_queue(env: Env, lp: Address, invoice_id: u64) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        require_lp(&env, &lp)?;
        let invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        
        match invoice.status {
            InvoiceStatus::Pending | InvoiceStatus::PartiallyFunded => {}
            _ => return Err(ContractError::AlreadyFunded),
        }

        if get_queue_resolution(&env, invoice_id).is_some() {
            return Err(ContractError::NotApprovedFunder);
        }

        let mut queue = get_fund_queue(&env, invoice_id);
        for item in queue.iter() {
            if item.lp == lp { return Err(ContractError::AlreadyInQueue); }
        }

        let score = get_lp_score(&env, &lp);
        queue.push_back(LpFundRequest {
            lp: lp.clone(),
            score,
        });
        save_fund_queue(&env, invoice_id, &queue);
        
        env.events().publish_event(&FundRequested {
            invoice_id,
            lp,
            score,
        });
        Ok(())
    }

    pub fn resolve_fund_queue(env: Env, invoice_id: u64) -> Result<Address, ContractError> {
        let queue = get_fund_queue(&env, invoice_id);
        if queue.is_empty() { return Err(ContractError::NotFunded); }

        if let Some(approved) = get_queue_resolution(&env, invoice_id) {
            return Ok(approved);
        }

        let mut best_lp = queue.get(0).unwrap().lp.clone();
        let mut best_score = queue.get(0).unwrap().score;

        for i in 1..queue.len() {
            let item = queue.get(i).unwrap();
            if item.score > best_score {
                best_score = item.score;
                best_lp = item.lp.clone();
            }
        }

        save_queue_resolution(&env, invoice_id, &best_lp);
        
        env.events().publish_event(&FundQueueResolved {
            invoice_id,
            approved_lp: best_lp.clone(),
            score: best_score,
        });
        Ok(best_lp)
    }

    pub fn suggested_discount_rate(env: Env, payer: Address) -> u32 {
        let score = get_payer_score(&env, &payer);
        let capped = score.min(100);
        let rate = 500 + (100 - capped) * 5;
        rate.max(50)
    }

    pub fn get_top_payers(env: Env, limit: u32) -> Vec<TopPayerEntry> {
        crate::top_payers::get_top_payers(&env, limit)
    }

    pub fn transfer_invoice(env: Env, invoice_id: u64, new_freelancer: Address) -> Result<(), ContractError> {
        if is_paused(&env) { return Err(ContractError::ContractPaused); }
        let mut invoice = try_load_invoice(&env, invoice_id).ok_or(ContractError::InvoiceNotFound)?;
        require_submitter_by_id(&env, &invoice.freelancer, invoice_id)?;
        
        match invoice.status {
            InvoiceStatus::Pending => {}
            _ => return Err(ContractError::AlreadyFunded),
        }

        let old_freelancer = invoice.freelancer.clone();
        invoice.freelancer = new_freelancer.clone();
        save_invoice(&env, &invoice);
        
        remove_invoice_from_submitter(&env, &old_freelancer, invoice_id);
        add_invoice_to_submitter(&env, &new_freelancer, invoice_id);

        env.events().publish_event(&InvoiceTransferred {
            invoice_id,
            old_freelancer,
            new_freelancer,
            status: invoice.status,
        });
        Ok(())
    }
}

fn token_client<'a>(env: &'a Env, token: &Address) -> TokenClient<'a> { TokenClient::new(env, token) }
fn discount_rate_as_i128(rate: u32) -> i128 { rate as i128 }
fn is_xlm_token(env: &Env, token: &Address) -> bool {
    storage::get_config(env).map_or(false, |c| token == &c.xlm_sac_address)
}
fn normalize_xlm_amount(amount: i128) -> i128 { amount }
fn normalize_usdc_amount(amount: i128) -> i128 { amount }

fn validate_invoice_terms(env: &Env, amount: i128, due_date: u64, discount_rate: u32) -> Result<(), ContractError> {
    if amount < 1_000_000 { return Err(ContractError::InvalidAmount); }
    let max_rate: u32 = env.storage().instance().get(&StorageKey::MaxDiscountRate).unwrap_or(5000);
    if discount_rate == 0 || discount_rate > max_rate { return Err(ContractError::InvalidDiscountRate); }
    if due_date > u64::from(u32::MAX) { return Err(ContractError::InvalidDueDate); }
    let now = env.ledger().timestamp();
    if due_date <= now { return Err(ContractError::InvalidDueDate); }
    if due_date < now + MIN_INVOICE_DURATION { return Err(ContractError::DueDateTooSoon); }
    if due_date > now + MAX_INVOICE_DURATION { return Err(ContractError::DueDateTooFar); }
    Ok(())
}

fn is_approved_token(env: &Env, token: &Address) -> bool {
    env.storage().persistent().get(&StorageKey::ApprovedToken(token.clone())).unwrap_or(false)
}

fn notify_distribution_funding(env: &Env, lp: &Address, amount: i128) {
    if let Some(dist) = env.storage().instance().get::<_, Address>(&StorageKey::DistributionContract) {
        env.invoke_contract::<()>(&dist, &Symbol::new(env, "accrue_lp"), vec![env, lp.clone().into_val(env), amount.into_val(env)]);
    }
}

fn notify_distribution_settlement(env: &Env, freelancer: &Address, payer: &Address, on_time: bool) {
    if let Some(dist) = env.storage().instance().get::<_, Address>(&StorageKey::DistributionContract) {
        env.invoke_contract::<()>(&dist, &Symbol::new(env, "accrue_settlement"), vec![env, freelancer.clone().into_val(env), payer.clone().into_val(env), on_time.into_val(env)]);
    }
}

mod test;
#[cfg(test)]
mod tests_access_control;
mod tests_appeal;
mod tests_arithmetic;
mod tests_auth;
mod tests_dispute;
mod tests_distribution;
mod tests_invariants;
#[cfg(test)]
mod tests_invoice_paid_event;
#[cfg(test)]
mod tests_lp_funding_details_event;
mod tests_lp_priority_queue;
mod tests_mutation;
#[cfg(test)]
mod tests_partial_payment;
mod tests_protocol_fee;
mod tests_security;
mod tests_state_machine;
mod tests_storage;
mod tests_storage_extra;
#[cfg(test)]
mod tests_governance_features;
