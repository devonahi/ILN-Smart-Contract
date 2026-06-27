/**
 * `iln wallet` — keypair and profile management.
 *
 * Sub-commands:
 *   iln wallet generate [--profile <name>]   — create and store a keypair
 *   iln wallet list                          — list all profiles
 *
 * Issue: #246
 */
import { Command } from "commander";
import { listProfiles, saveProfile } from "../config.js";

/** Generate a deterministic-looking keypair for demo/test purposes.
 *  In production this would use @stellar/stellar-sdk Keypair.random(). */
export function generateKeypair(): { publicKey: string; secretKey: string } {
  const rand = Math.random().toString(36).slice(2).toUpperCase().padEnd(54, "0");
  return {
    publicKey: `G${rand.slice(0, 55)}`,
    secretKey: `S${rand.slice(0, 55)}`,
  };
}

export function makeWalletCommand(): Command {
  const cmd = new Command("wallet").description(
    "Manage Stellar keypairs and named profiles"
  );

  // iln wallet generate [--profile name]
  cmd
    .command("generate")
    .description("Generate a new Stellar keypair and store it as a named profile")
    .option("--profile <name>", "Profile name to store the keypair under", "default")
    .option("--json", "Output result as JSON")
    .action((opts: { profile: string; json?: boolean }) => {
      const kp = generateKeypair();
      saveProfile({ name: opts.profile, publicKey: kp.publicKey, secretKey: kp.secretKey });

      if (opts.json) {
        console.log(JSON.stringify({ profile: opts.profile, publicKey: kp.publicKey }));
      } else {
        console.log(`✓ Keypair generated and saved as profile "${opts.profile}"`);
        console.log(`  Public key : ${kp.publicKey}`);
        console.log(`  Profile    : ~/.iln/profiles/${opts.profile}.json`);
      }
    });

  // iln wallet list
  cmd
    .command("list")
    .description("List all saved profiles with their public keys")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const profiles = listProfiles();
      if (opts.json) {
        console.log(
          JSON.stringify(
            profiles.map((p) => ({ name: p.name, publicKey: p.publicKey })),
            null,
            2
          )
        );
      } else if (profiles.length === 0) {
        console.log("No profiles found. Run: iln wallet generate");
      } else {
        for (const p of profiles) {
          console.log(`${p.name.padEnd(20)} ${p.publicKey}`);
        }
      }
    });

  return cmd;
}
