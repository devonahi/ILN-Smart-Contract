/**
 * Tests for `iln status --watch` mode (#231).
 */
import { makeStatusCommand } from "../../src/commands/status";
import type { InvoiceDetail } from "../../src/commands/status-types";

function makeInvoice(state: InvoiceDetail["state"]): InvoiceDetail {
  return {
    id: "INV-700",
    state,
    submitter: "GSUB0000000000000000000000000000000000000000000000000001",
    payer: "GPAY0000000000000000000000000000000000000000000000000001",
    token: "USDC",
    amount: "100",
    discountRateBps: 300,
    effectiveYieldPct: "3.00",
    dueDate: "2026-12-31",
    createdAt: "2026-06-01T00:00:00Z",
  };
}

describe("iln status --watch", () => {
  it("does not set interval when invoice is already in a terminal state", async () => {
    const fetcher = jest.fn().mockResolvedValue(makeInvoice("Paid"));
    const mockSetInterval = jest.fn();
    const mockClearInterval = jest.fn();
    const cmd = makeStatusCommand(fetcher, mockSetInterval as unknown as typeof setInterval, mockClearInterval);

    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-700", "--watch"], { from: "user" });

    expect(mockSetInterval).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("sets interval when invoice is in a non-terminal state with --watch", async () => {
    const fetcher = jest.fn().mockResolvedValue(makeInvoice("Pending"));
    const mockSetInterval = jest.fn().mockReturnValue(99);
    const mockClearInterval = jest.fn();
    const cmd = makeStatusCommand(fetcher, mockSetInterval as unknown as typeof setInterval, mockClearInterval);

    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-700", "--watch"], { from: "user" });

    expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 10_000);
    jest.restoreAllMocks();
  });

  it("does not set interval without --watch flag even for non-terminal state", async () => {
    const fetcher = jest.fn().mockResolvedValue(makeInvoice("Funded"));
    const mockSetInterval = jest.fn();
    const mockClearInterval = jest.fn();
    const cmd = makeStatusCommand(fetcher, mockSetInterval as unknown as typeof setInterval, mockClearInterval);

    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-700"], { from: "user" });

    expect(mockSetInterval).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
