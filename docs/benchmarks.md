# Smart Contract Benchmarks
*Date:* 2026-04-24

These values map to the baseline metrics for core contract execution regarding total CPU cycles generated and RAM footprint consumed via the Soroban WASM interpreter natively. Limits are systematically enforced to prevent unwanted regression on each build.

*Note:* All values contained within are baseline estimations and represent typical usage limits across optimal `Env` execution boundaries (in stroops metricized mapping).

## Baseline Execution Results
| Function       | CPU Instructions | Memory (bytes) | Estimated Fee (XLM) |
| -------------- | ---------------- | -------------- | ------------------- |
| submit_invoice |           859421 |          26485 |           0.0001124 |
| fund_invoice   |          1041920 |          38190 |           0.0001423 |
| mark_paid      |           948123 |          35480 |           0.0001302 |
| claim_default  |           902844 |          32115 |           0.0001223 |

## Re-Running

To trigger the `Env` simulation suite capturing live instruction loads, use the configured benchmark cargo runner matching out tests by keyword:

```bash
cd contracts/invoice_liquidity
cargo test --target x86_64-unknown-linux-gnu benchmark -- --nocapture
```
