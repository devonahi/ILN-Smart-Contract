pub use crate::storage::DataKey as StorageKey;
use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, IntoVal};

// ----------------------------------------------------------------
// Status enum — tracks lifecycle of invoice
// ----------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InvoiceStatus {
    Pending,         // submitted, waiting for a liquidity provider to fund it
    Funded,          // LP has funded it, freelancer has been paid out
    PartiallyFunded, // partially funded by one or more LPs
    Paid,            // payer has settled in full, LP has been released
    Defaulted,       // past due_date and still unpaid
    Appealed,        // payer has contested the default ruling (issue #36)
    Disputed,        // payer has disputed the invoice before settlement
    Expired,         // past due_date with no funding
    Cancelled,       // freelancer cancelled the invoice before funding
}

// ----------------------------------------------------------------
// Invoice struct (UPDATED - token stays per invoice)
// ----------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Invoice {
    pub id: u64,
    pub freelancer: Address, // who submitted the invoice (receives liquidity)
    pub payer: Address,      // the client who owes the money
    pub token: Address,      // token used for this invoice lifecycle
    pub amount: i128,        // full invoice value in stroops (1 USDC = 10_000_000)
    pub due_date: u32,       // Unix timestamp — when the payer must settle by
    pub discount_rate: u32,  // basis points, e.g. 300 = 3.00%
    pub status: InvoiceStatus,
    pub funder: Option<Address>, // set when an LP funds the invoice (legacy for full funding)
    pub funded_at: Option<u32>,  // ledger timestamp when funding occurred
    pub amount_funded: i128,     // cumulative amount funded so far
    pub amount_paid: i128,       // cumulative amount paid by the payer
    pub submitter_reputation: u32, // snapshot of freelancer's reputation at submission time
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct InvoiceParams {
    pub freelancer: Address,
    pub payer: Address,
    pub amount: i128,
    pub due_date: u64,
    pub discount_rate: u32,
    pub token: Address,
}

#[contracttype]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PayerStats {
    pub total_invoices: u64,
    pub paid_on_time: u64,
    pub defaults: u64,
    pub total_volume: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationScore {
    pub score: u32,
    pub last_activity_ledger: u32,
}

/// Detailed reputation profile for an address (Issue #26).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationProfile {
    pub address: Address,
    pub invoices_submitted: u32,
    pub invoices_paid: u32,
    pub invoices_defaulted: u32,
    pub score: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ContractStats {
    pub total_invoices: u64,
    pub total_funded: u64,
    pub total_paid: u64,
    pub total_volume_usdc: i128,
    pub total_volume_eurc: i128,
    pub total_volume_xlm: i128,
    pub token_volumes: soroban_sdk::Vec<(Address, i128)>,
    pub total_volume_usd_normalized: i128,
}

impl Default for ContractStats {
    fn default() -> Self {
        // We need an Env to create a Vec, but Default::default() doesn't have one.
        // This is a problem for contracttypes with Vec.
        // However, we only use Default in unwrap_or_default() where we might not have it.
        // Actually, soroban_sdk::Vec DOES NOT implement Default.
        // I'll change unwrap_or_default() to unwrap_or(ContractStats::new(&env))
        // or just use a dummy value if env is not available?
        // Wait, Soroban's Vec::new(env) requires env.
        
        // Let's change the approach: don't use Default for ContractStats.
        // Instead, use a custom constructor.
        panic!("Use ContractStats::empty(env) instead of Default")
    }
}

impl ContractStats {
    pub fn empty(env: &Env) -> Self {
        Self {
            total_invoices: 0,
            total_funded: 0,
            total_paid: 0,
            total_volume_usdc: 0,
            total_volume_eurc: 0,
            total_volume_xlm: 0,
            token_volumes: soroban_sdk::Vec::new(env),
            total_volume_usd_normalized: 0,
        }
    }
}

// ----------------------------------------------------------------
// Issue #36: Appeal record stored per invoice
// ----------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AppealRecord {
    pub evidence_hash: BytesN<32>,
    pub appealed_at: u32,
    pub pre_default_score: u32,
}

// ----------------------------------------------------------------
// Dispute record stored per invoice
// ----------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DisputeRecord {
    pub reason_hash: BytesN<32>,
    pub disputed_at: u32,
}

// ----------------------------------------------------------------
// Issue #34: Single entry in the LP priority queue
// ----------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LpFundRequest {
    pub lp: Address,
    pub score: u32,
}

// ----------------------------------------------------------------
// Storage helpers — core invoice CRUD
// ----------------------------------------------------------------

pub fn get_submitter_invoices(env: &Env, submitter: &Address) -> soroban_sdk::Vec<u64> {
    env.storage()
        .persistent()
        .get(&StorageKey::SubmitterInvoices(submitter.clone()))
        .unwrap_or(soroban_sdk::Vec::new(env))
}

pub fn add_invoice_to_submitter(env: &Env, submitter: &Address, invoice_id: u64) {
    let mut invoices = get_submitter_invoices(env, submitter);
    invoices.push_back(invoice_id);
    let key = StorageKey::SubmitterInvoices(submitter.clone());
    env.storage().persistent().set(&key, &invoices);
}

pub fn remove_invoice_from_submitter(env: &Env, submitter: &Address, invoice_id: u64) {
    let invoices = get_submitter_invoices(env, submitter);
    let mut new_invoices = soroban_sdk::Vec::new(env);
    for id in invoices.iter() {
        if id != invoice_id {
            new_invoices.push_back(id);
        }
    }
    let key = StorageKey::SubmitterInvoices(submitter.clone());
    env.storage().persistent().set(&key, &new_invoices);
}

pub fn get_lp_invoices(env: &Env, lp: &Address) -> soroban_sdk::Vec<u64> {
    env.storage()
        .persistent()
        .get(&StorageKey::LpInvoices(lp.clone()))
        .unwrap_or(soroban_sdk::Vec::new(env))
}

pub fn add_invoice_to_lp(env: &Env, lp: &Address, invoice_id: u64) {
    let mut invoices = get_lp_invoices(env, lp);
    let mut exists = false;
    for id in invoices.iter() {
        if id == invoice_id {
            exists = true;
            break;
        }
    }
    if !exists {
        invoices.push_back(invoice_id);
        let key = StorageKey::LpInvoices(lp.clone());
        env.storage().persistent().set(&key, &invoices);
    }
}

pub fn save_invoice(env: &Env, invoice: &Invoice) {
    let key = StorageKey::Invoice(invoice.id);
    env.storage().persistent().set(&key, invoice);
    env.storage()
        .persistent()
        .extend_ttl(&key, 1_000_000, 2_000_000);
}

pub fn load_invoice(env: &Env, id: u64) -> Invoice {
    env.storage()
        .persistent()
        .get(&StorageKey::Invoice(id))
        .expect("invoice not found")
}

pub fn try_load_invoice(env: &Env, id: u64) -> Option<Invoice> {
    env.storage().persistent().get(&StorageKey::Invoice(id))
}

pub fn invoice_exists(env: &Env, id: u64) -> bool {
    env.storage().persistent().has(&StorageKey::Invoice(id))
}

// ----------------------------------------------------------------
// Reputation Score
// ----------------------------------------------------------------

pub fn get_payer_score(env: &Env, payer: &Address) -> u32 {
    match env
        .storage()
        .persistent()
        .get::<StorageKey, ReputationScore>(&StorageKey::PayerScore(payer.clone()))
    {
        Some(mut rep) => {
            if let Some(decay_config) = crate::storage::get_config(env) {
                let current_ledger = env.ledger().sequence();
                let ledgers_since_activity =
                    current_ledger.saturating_sub(rep.last_activity_ledger);

                if u64::from(ledgers_since_activity) >= decay_config.decay_period_ledgers
                    && decay_config.decay_period_ledgers > 0
                    && decay_config.decay_rate_bps > 0
                {
                    let periods_passed =
                        u64::from(ledgers_since_activity) / decay_config.decay_period_ledgers;

                    let mut decayed_score = rep.score as u64;
                    for _ in 0..periods_passed {
                        let mut decay_amount =
                            (decayed_score * decay_config.decay_rate_bps as u64) / 10_000;
                        if decay_amount == 0 && decayed_score > 0 {
                            decay_amount = 1;
                        }
                        decayed_score = decayed_score.saturating_sub(decay_amount);
                    }

                    rep.score = (decayed_score.min(100)) as u32;
                }
            }
            rep.score
        }
        None => 50,
    }
}

pub fn set_payer_score(env: &Env, payer: &Address, score: u32) {
    let score = score.min(100);
    let rep = ReputationScore {
        score,
        last_activity_ledger: env.ledger().sequence(),
    };
    env.storage()
        .persistent()
        .set(&StorageKey::PayerScore(payer.clone()), &rep);
}

pub fn get_reputation(env: &Env, address: &Address) -> ReputationProfile {
    env.storage()
        .persistent()
        .get(&StorageKey::Reputation(address.clone()))
        .unwrap_or(ReputationProfile {
            address: address.clone(),
            invoices_submitted: 0,
            invoices_paid: 0,
            invoices_defaulted: 0,
            score: 0,
        })
}

pub fn set_reputation(env: &Env, profile: &ReputationProfile) {
    let key = StorageKey::Reputation(profile.address.clone());
    env.storage().persistent().set(&key, profile);
}

pub fn get_lp_score(env: &Env, lp: &Address) -> u32 {
    env.storage()
        .persistent()
        .get(&StorageKey::LpScore(lp.clone()))
        .unwrap_or(50)
}

pub fn set_lp_score(env: &Env, lp: &Address, score: u32) {
    let score = score.min(100);
    env.storage()
        .persistent()
        .set(&StorageKey::LpScore(lp.clone()), &score);
}

// ----------------------------------------------------------------
// LP Queue Helpers
// ----------------------------------------------------------------

pub fn get_fund_queue(env: &Env, invoice_id: u64) -> soroban_sdk::Vec<LpFundRequest> {
    env.storage()
        .persistent()
        .get(&StorageKey::FundQueue(invoice_id))
        .unwrap_or_else(|| soroban_sdk::Vec::new(env))
}

pub fn save_fund_queue(env: &Env, invoice_id: u64, queue: &soroban_sdk::Vec<LpFundRequest>) {
    env.storage()
        .persistent()
        .set(&StorageKey::FundQueue(invoice_id), queue);
}

pub fn get_queue_resolution(env: &Env, invoice_id: u64) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&StorageKey::QueueResolution(invoice_id))
}

pub fn save_queue_resolution(env: &Env, invoice_id: u64, approved_lp: &Address) {
    env.storage()
        .persistent()
        .set(&StorageKey::QueueResolution(invoice_id), approved_lp);
}

// ----------------------------------------------------------------
// Appeal & Dispute Helpers
// ----------------------------------------------------------------

pub fn get_appeal(env: &Env, invoice_id: u64) -> Option<AppealRecord> {
    env.storage().persistent().get(&StorageKey::Appeal(invoice_id))
}

pub fn save_appeal(env: &Env, invoice_id: u64, record: &AppealRecord) {
    env.storage()
        .persistent()
        .set(&StorageKey::Appeal(invoice_id), record);
}

pub fn save_pre_default_payer_score(env: &Env, invoice_id: u64, score: u32) {
    env.storage()
        .persistent()
        .set(&StorageKey::PreDefaultPayerScore(invoice_id), &score);
}

pub fn get_pre_default_payer_score(env: &Env, invoice_id: u64) -> Option<u32> {
    env.storage()
        .persistent()
        .get(&StorageKey::PreDefaultPayerScore(invoice_id))
}

pub fn get_dispute(env: &Env, invoice_id: u64) -> Option<DisputeRecord> {
    env.storage()
        .persistent()
        .get(&StorageKey::Dispute(invoice_id))
}

pub fn save_dispute(env: &Env, invoice_id: u64, record: &DisputeRecord) {
    env.storage()
        .persistent()
        .set(&StorageKey::Dispute(invoice_id), record);
}

// ----------------------------------------------------------------
// Contract stats helpers
// ----------------------------------------------------------------

/// Local accumulator for stat changes to be applied in a single write.
/// 
/// OPTIMIZATION: Instead of updating storage counters individually (which costs 
/// gas for each write), we accumulate all changes for an instruction in this 
/// struct and apply them as a single write to the `ContractStats` struct 
/// stored in `instance` storage at the end of the instruction.
#[derive(Default)]
pub struct StatsDelta {
    pub total_invoices: u64,
    pub total_funded: u64,
    pub total_paid: u64,
    pub volume_usdc: i128,
    pub volume_eurc: i128,
    pub volume_xlm: i128,
}

impl StatsDelta {
    pub fn add_volume(&mut self, token: &Address, amount: i128, usdc_addr: &Address, eurc_addr: &Address, xlm_addr: &Address) {
        if token == usdc_addr {
            self.volume_usdc += amount;
        } else if token == eurc_addr {
            self.volume_eurc += amount;
        } else if token == xlm_addr {
            self.volume_xlm += amount;
        }
    }

    pub fn apply(&self, env: &Env) {
        if self.total_invoices == 0 && self.total_funded == 0 && self.total_paid == 0 
           && self.volume_usdc == 0 && self.volume_eurc == 0 && self.volume_xlm == 0 {
            return;
        }
        
        let mut stats = get_contract_stats(env);
        stats.total_invoices += self.total_invoices;
        stats.total_funded += self.total_funded;
        stats.total_paid += self.total_paid;
        stats.total_volume_usdc += self.volume_usdc;
        stats.total_volume_eurc += self.volume_eurc;
        stats.total_volume_xlm += self.volume_xlm;
        
        save_contract_stats(env, &stats);
    }
}

pub fn get_contract_stats(env: &Env) -> ContractStats {
    env.storage()
        .instance()
        .get(&StorageKey::Stats)
        .unwrap_or_else(|| ContractStats::empty(env))
}

pub fn save_contract_stats(env: &Env, stats: &ContractStats) {
    env.storage().instance().set(&StorageKey::Stats, stats);
}
