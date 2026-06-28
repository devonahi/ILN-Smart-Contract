/**
 * Tests for `iln fund` — confirm prompt and --yes flag (#230).
 */
import { makeFundCommand } from "../../src/commands/fund";
import type { MarketplaceListing, FundResult } from "../../src/commands/marketplace-types";

function mockListing(id = "INV-101"): MarketplaceListing {
  return { id, amount: "500", token: "USDC", yieldPct: "3.20", dueDate: "2025-12-31", payerReputation: "high" };
}

function mockFundResult(id = "INV-101"): FundResult {
  return { invoiceId: id, txHash: "TXFUND001" };
}

describe("iln fund — confirmation flow", () => {
  it("funds invoice when user confirms", async () => {
    const fetcher = jest.fn().mockResolvedValue(mockListing());
    const executor = jest.fn().mockResolvedValue(mockFundResult());
    const confirm = jest.fn().mockResolvedValue(true);
    const cmd = makeFundCommand(fetcher, executor, confirm);

    const logs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));

    await cmd.parseAsync(["--id", "INV-101"], { from: "user" });

    expect(executor).toHaveBeenCalledWith("INV-101");
    expect(logs.some((l) => l.includes("Funded invoice"))).toBe(true);
    expect(logs.some((l) => l.includes("TXFUND001"))).toBe(true);
    jest.restoreAllMocks();
  });

  it("shows amount, token, and yield in the confirm prompt", async () => {
    const fetcher = jest.fn().mockResolvedValue(mockListing());
    const executor = jest.fn().mockResolvedValue(mockFundResult());
    const confirm = jest.fn().mockResolvedValue(true);
    const cmd = makeFundCommand(fetcher, executor, confirm);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-101"], { from: "user" });

    const promptMsg = (confirm.mock.calls[0] as string[])[0];
    expect(promptMsg).toContain("500 USDC");
    expect(promptMsg).toContain("3.20%");
    jest.restoreAllMocks();
  });

  it("aborts when user declines confirmation", async () => {
    const fetcher = jest.fn().mockResolvedValue(mockListing());
    const executor = jest.fn();
    const confirm = jest.fn().mockResolvedValue(false);
    const cmd = makeFundCommand(fetcher, executor, confirm);

    const logs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));

    await cmd.parseAsync(["--id", "INV-101"], { from: "user" });

    expect(executor).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("Aborted"))).toBe(true);
    jest.restoreAllMocks();
  });

  it("skips confirmation and funds immediately with --yes", async () => {
    const fetcher = jest.fn().mockResolvedValue(mockListing());
    const executor = jest.fn().mockResolvedValue(mockFundResult());
    const confirm = jest.fn();
    const cmd = makeFundCommand(fetcher, executor, confirm);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-101", "--yes"], { from: "user" });

    expect(confirm).not.toHaveBeenCalled();
    expect(executor).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("exits with error when fetcher throws", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("Not found"));
    const executor = jest.fn();
    const cmd = makeFundCommand(fetcher, executor, jest.fn());
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {}) as never);
    jest.spyOn(console, "error").mockImplementation(() => {});

    await cmd.parseAsync(["--id", "INV-999"], { from: "user" });

    expect(exit).toHaveBeenCalledWith(1);
    jest.restoreAllMocks();
  });
});
