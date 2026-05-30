#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Vec,
};

pub(crate) fn setup() -> TestContext<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let payer = Address::generate(&env);
    let funder = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let xlm_token = env.register_stellar_asset_contract_v2(token_admin).address();

    let contract_id = env.register(InvoiceLiquidityContract, ());
    let client = InvoiceLiquidityContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token, &xlm_token);

    TestContext {
        env,
        admin,
        freelancer,
        payer,
        funder,
        token,
        xlm_token,
        contract_id,
        contract: client,
    }
}

pub(crate) struct TestContext<'a> {
    pub(crate) env: Env,
    pub(crate) admin: Address,
    pub(crate) freelancer: Address,
    pub(crate) payer: Address,
    pub(crate) funder: Address,
    pub(crate) token: Address,
    pub(crate) xlm_token: Address,
    pub(crate) contract_id: Address,
    pub(crate) contract: InvoiceLiquidityContractClient<'a>,
}

#[test]
fn test_submit_invoice_happy_path() {
    let t = setup();
    let due_date = t.env.ledger().timestamp() + 86400 * 30;
    let id = t.contract.submit_invoice(
        &t.freelancer,
        &t.payer,
        &10_000_000,
        &due_date,
        &300,
        &t.token,
    );

    assert_eq!(id, 1);
    let invoice = t.contract.get_invoice(&id);
    assert_eq!(invoice.id, 1);
    assert_eq!(invoice.amount, 10_000_000);
    assert_eq!(invoice.status, InvoiceStatus::Pending);
}

#[test]
fn test_submit_invoices_batch_happy_path() {
    let t = setup();
    let due_date = t.env.ledger().timestamp() + 86400 * 30;
    
    let mut batch = Vec::new(&t.env);
    for _ in 0..3 {
        batch.push_back(InvoiceParams {
            freelancer: t.freelancer.clone(),
            payer: t.payer.clone(),
            amount: 10_000_000,
            due_date,
            discount_rate: 300,
            token: t.token.clone(),
        });
    }

    let ids = t.contract.submit_invoices_batch(&batch);
    assert_eq!(ids.len(), 3);
    assert_eq!(ids.get(0).unwrap(), 1);
    assert_eq!(ids.get(1).unwrap(), 2);
    assert_eq!(ids.get(2).unwrap(), 3);

    let stats = t.contract.get_contract_stats();
    assert_eq!(stats.total_invoices, 3);
}

#[test]
fn test_fund_invoice_full_lifecycle() {
    let t = setup();
    let due_date = t.env.ledger().timestamp() + 86400 * 30;
    let id = t.contract.submit_invoice(&t.freelancer, &t.payer, &10_000_000, &due_date, &300, &t.token);

    t.contract.fund_invoice(&t.funder, &id, &10_000_000);
    let invoice = t.contract.get_invoice(&id);
    assert_eq!(invoice.status, InvoiceStatus::Funded);

    t.contract.mark_paid(&id, &10_000_000);
    let invoice = t.contract.get_invoice(&id);
    assert_eq!(invoice.status, InvoiceStatus::Paid);
    
    let stats = t.contract.get_contract_stats();
    assert_eq!(stats.total_paid, 1);
    assert_eq!(stats.total_funded, 1);
}
