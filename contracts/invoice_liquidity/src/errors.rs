use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    Unauthorized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 3,
    InvalidDiscountRate = 4,
    InvalidDueDate = 5,
    InvoiceNotFound = 6,
    AlreadyPaid = 7,
    AlreadyFunded = 8,
    NotYetDefaulted = 9,
    InvoiceDefaulted = 10,
    OverfundingRejected = 11,
    OverpaymentRejected = 12,
    ArithmeticOverflow = 13,
    NothingToClaim = 14,
    SelfInvoice = 15,
    InvoiceExpired = 16,
    BatchTooLarge = 17,
    AlreadyCancelled = 18,
    ContractPaused = 19,
    DueDateTooSoon = 20,
    DueDateTooFar = 21,
    /// LP has already joined the fund queue for this invoice.
    AlreadyInQueue = 22,
    /// fund_invoice rejected because a different LP was selected by the priority queue.
    NotApprovedFunder = 23,
    /// payer's reputation is below the configured minimum threshold.
    PayerReputationTooLow = 24,
    /// Invoice is in Appealed state and cannot be acted upon yet.
    InvoiceAppealed = 25,
    /// Payer attempted to appeal an invoice that is already in Appealed state.
    AlreadyAppealed = 26,
    /// Appeal window has closed; appeal can no longer be submitted.
    AppealWindowClosed = 27,
    /// Action requires the invoice to be in Defaulted state.
    NotDefaulted = 28,
    AlreadyDisputed = 29,
    NotDisputed = 30,
    InvoiceDisputed = 31,
    NotFunded = 32,
}
