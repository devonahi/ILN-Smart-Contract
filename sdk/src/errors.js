"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ILNError = void 0;
class ILNError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
    }
    static fromError(error) {
        const errorString = String(error);
        const match = errorString.match(/Error\(Contract, (\d+)\)/);
        if (match) {
            const code = parseInt(match[1], 10);
            switch (code) {
                case 1: return new ILNError.InvoiceNotFound();
                case 2: return new ILNError.AlreadyFunded();
                case 3: return new ILNError.AlreadyPaid();
                case 4: return new ILNError.NotFunded();
                case 5: return new ILNError.Unauthorized();
                case 6: return new ILNError.InvalidAmount();
                case 7: return new ILNError.InvalidDiscountRate();
                case 8: return new ILNError.InvalidDueDate();
                case 9: return new ILNError.InvoiceDefaulted();
                case 10: return new ILNError.NothingToClaim();
                case 11: return new ILNError.NotYetDefaulted();
                case 12: return new ILNError.OverfundingRejected();
                case 13: return new ILNError.InvoiceExpired();
                case 14: return new ILNError.BatchTooLarge();
                case 15: return new ILNError.AlreadyCancelled();
                case 16: return new ILNError.AlreadyInitialized();
                case 17: return new ILNError.AlreadyAppealed();
                case 18: return new ILNError.AppealWindowClosed();
                case 19: return new ILNError.NotDefaulted();
                case 20: return new ILNError.AlreadyInQueue();
                case 21: return new ILNError.NotApprovedFunder();
                case 22: return new ILNError.InvoiceAppealed();
                case 23: return new ILNError.AlreadyDisputed();
                case 24: return new ILNError.NotDisputed();
                case 25: return new ILNError.InvoiceDisputed();
                case 26: return new ILNError.ContractPaused();
                case 27: return new ILNError.DueDateTooSoon();
                case 28: return new ILNError.DueDateTooFar();
                case 29: return new ILNError.SelfInvoice();
                case 30: return new ILNError.OverpaymentRejected();
                case 31: return new ILNError.PayerReputationTooLow();
                case 32: return new ILNError.ArithmeticOverflow();
                case 33: return new ILNError.FeeOnTransferToken();
                case 34: return new ILNError.PayerUnverified();
                case 35: return new ILNError.OracleDataStale();
                case 36: return new ILNError.AmountTooSmall();
                case 37: return new ILNError.InvoiceNotCancellable();
            }
        }
        return new Error(errorString);
    }
}
exports.ILNError = ILNError;
ILNError.InvoiceNotFound = class extends ILNError {
    constructor(msg = "Invoice not found") { super(msg, 1); }
};
ILNError.AlreadyFunded = class extends ILNError {
    constructor(msg = "Invoice already funded") { super(msg, 2); }
};
ILNError.AlreadyPaid = class extends ILNError {
    constructor(msg = "Invoice already paid") { super(msg, 3); }
};
ILNError.NotFunded = class extends ILNError {
    constructor(msg = "Invoice not funded") { super(msg, 4); }
};
ILNError.Unauthorized = class extends ILNError {
    constructor(msg = "Unauthorized") { super(msg, 5); }
};
ILNError.InvalidAmount = class extends ILNError {
    constructor(msg = "Invalid amount") { super(msg, 6); }
};
ILNError.InvalidDiscountRate = class extends ILNError {
    constructor(msg = "Invalid discount rate") { super(msg, 7); }
};
ILNError.InvalidDueDate = class extends ILNError {
    constructor(msg = "Invalid due date") { super(msg, 8); }
};
ILNError.InvoiceDefaulted = class extends ILNError {
    constructor(msg = "Invoice defaulted") { super(msg, 9); }
};
ILNError.NothingToClaim = class extends ILNError {
    constructor(msg = "Nothing to claim") { super(msg, 10); }
};
ILNError.NotYetDefaulted = class extends ILNError {
    constructor(msg = "Not yet defaulted") { super(msg, 11); }
};
ILNError.OverfundingRejected = class extends ILNError {
    constructor(msg = "Overfunding rejected") { super(msg, 12); }
};
ILNError.InvoiceExpired = class extends ILNError {
    constructor(msg = "Invoice expired") { super(msg, 13); }
};
ILNError.BatchTooLarge = class extends ILNError {
    constructor(msg = "Batch too large") { super(msg, 14); }
};
ILNError.AlreadyCancelled = class extends ILNError {
    constructor(msg = "Already cancelled") { super(msg, 15); }
};
ILNError.AlreadyInitialized = class extends ILNError {
    constructor(msg = "Already initialized") { super(msg, 16); }
};
ILNError.AlreadyAppealed = class extends ILNError {
    constructor(msg = "Already appealed") { super(msg, 17); }
};
ILNError.AppealWindowClosed = class extends ILNError {
    constructor(msg = "Appeal window closed") { super(msg, 18); }
};
ILNError.NotDefaulted = class extends ILNError {
    constructor(msg = "Not defaulted") { super(msg, 19); }
};
ILNError.AlreadyInQueue = class extends ILNError {
    constructor(msg = "Already in queue") { super(msg, 20); }
};
ILNError.NotApprovedFunder = class extends ILNError {
    constructor(msg = "Not approved funder") { super(msg, 21); }
};
ILNError.InvoiceAppealed = class extends ILNError {
    constructor(msg = "Invoice appealed") { super(msg, 22); }
};
ILNError.AlreadyDisputed = class extends ILNError {
    constructor(msg = "Already disputed") { super(msg, 23); }
};
ILNError.NotDisputed = class extends ILNError {
    constructor(msg = "Not disputed") { super(msg, 24); }
};
ILNError.InvoiceDisputed = class extends ILNError {
    constructor(msg = "Invoice disputed") { super(msg, 25); }
};
ILNError.ContractPaused = class extends ILNError {
    constructor(msg = "Contract paused") { super(msg, 26); }
};
ILNError.DueDateTooSoon = class extends ILNError {
    constructor(msg = "Due date too soon") { super(msg, 27); }
};
ILNError.DueDateTooFar = class extends ILNError {
    constructor(msg = "Due date too far") { super(msg, 28); }
};
ILNError.SelfInvoice = class extends ILNError {
    constructor(msg = "Self invoice") { super(msg, 29); }
};
ILNError.OverpaymentRejected = class extends ILNError {
    constructor(msg = "Overpayment rejected") { super(msg, 30); }
};
ILNError.PayerReputationTooLow = class extends ILNError {
    constructor(msg = "Payer reputation too low") { super(msg, 31); }
};
ILNError.ArithmeticOverflow = class extends ILNError {
    constructor(msg = "Arithmetic overflow") { super(msg, 32); }
};
ILNError.FeeOnTransferToken = class extends ILNError {
    constructor(msg = "Fee on transfer token") { super(msg, 33); }
};
ILNError.PayerUnverified = class extends ILNError {
    constructor(msg = "Payer unverified") { super(msg, 34); }
};
ILNError.OracleDataStale = class extends ILNError {
    constructor(msg = "Oracle data stale") { super(msg, 35); }
};
ILNError.AmountTooSmall = class extends ILNError {
    constructor(msg = "Amount too small") { super(msg, 36); }
};
ILNError.InvoiceNotCancellable = class extends ILNError {
    constructor(msg = "Invoice not cancellable") { super(msg, 37); }
};
ILNError.InvalidAddress = class extends ILNError {
    constructor(msg = "Invalid address") { super(msg, 38); }
};
ILNError.InvalidTransfer = class extends ILNError {
    constructor(msg = "Invalid transfer") { super(msg, 39); }
};
ILNError.InsufficientAmount = class extends ILNError {
    constructor(msg = "Insufficient amount") { super(msg, 999); }
};
