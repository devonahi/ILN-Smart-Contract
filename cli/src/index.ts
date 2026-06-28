#!/usr/bin/env node
/**
 * ILN CLI entry point.
 *
 * Global flag:
 *   --profile <name>   Use a named keypair profile (issue #246)
 */
import { Command } from "commander";
import { makeConfigCommand } from "./commands/config.js";
import { makeExportCommand } from "./commands/export.js";
import { makeWalletCommand } from "./commands/wallet.js";
import { makeReputationCommand } from "./commands/reputation.js";
import { makeCompletionCommand } from "./commands/completion.js";

const program = new Command();

program
  .name("iln")
  .description("Invoice Liquidity Network CLI")
  .version("0.1.0")
  .option("--profile <name>", "Named keypair profile to use for this command");

program.addCommand(makeConfigCommand());
program.addCommand(makeExportCommand());
program.addCommand(makeWalletCommand());
program.addCommand(makeReputationCommand());
program.addCommand(makeCompletionCommand());

program.parse(process.argv);
