/**
 * Tests for `iln submit --dry-run` (#229).
 */
import { makeSubmitCommand } from "../../src/commands/submit";
import type { SubmitResult } from "../../src/commands/submit-types";

const VALID_PAYER = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFG";

function makeResult(): SubmitResult {
  return {
    invoiceId: "INV-999",
    txHash: "TXDRYRUN",
    payer: VALID_PAYER,
    amount: "500",
    token: "EURC",
    rateBps: 200,
    yieldPct: "2.00",
    dueDate: "2026-06-30",
  };
}

describe("iln submit --dry-run", () => {
  it("prints transaction payload without calling submitter", async () => {
    const submitter = jest.fn().mockResolvedValue(makeResult());
    const prompter = jest.fn();
    const cmd = makeSubmitCommand(prompter, submitter);

    const logs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));

    await cmd.parseAsync([
      "--payer", VALID_PAYER,
      "--amount", "500",
      "--token", "EURC",
      "--rate", "200",
      "--due", "2026-06-30",
      "--dry-run",
    ], { from: "user" });

    expect(submitter).not.toHaveBeenCalled();
    const output = logs.join("\n");
    expect(output).toContain("dry-run");
    expect(output).toContain(VALID_PAYER);
    jest.restoreAllMocks();
  });

  it("dry-run output is valid JSON", async () => {
    const submitter = jest.fn();
    const prompter = jest.fn();
    const cmd = makeSubmitCommand(prompter, submitter);

    const logs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));

    await cmd.parseAsync([
      "--payer", VALID_PAYER,
      "--amount", "100",
      "--rate", "300",
      "--due", "2025-12-31",
      "--dry-run",
    ], { from: "user" });

    const jsonLine = logs.find((l) => l.trim().startsWith("{"));
    expect(jsonLine).toBeDefined();
    expect(() => JSON.parse(jsonLine!)).not.toThrow();
    jest.restoreAllMocks();
  });

  it("dry-run exits cleanly (no process.exit call)", async () => {
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const cmd = makeSubmitCommand(jest.fn(), jest.fn());
    jest.spyOn(console, "log").mockImplementation(() => {});

    await cmd.parseAsync([
      "--payer", VALID_PAYER, "--amount", "100", "--rate", "300", "--due", "2025-12-31", "--dry-run",
    ], { from: "user" });

    expect(exit).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
