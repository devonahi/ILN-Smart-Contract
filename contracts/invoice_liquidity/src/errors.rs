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
    AlreadyInQueue = 22,
    NotApprovedFunder = 23,
    PayerReputationTooLow = 24,
    InvoiceAppealed = 25,
    AlreadyAppealed = 26,
    AppealWindowClosed = 27,
    NotDefaulted = 28,
    AlreadyDisputed = 29,
    NotDisputed = 30,
    InvoiceDisputed = 31,
    NotFunded = 32,
}
