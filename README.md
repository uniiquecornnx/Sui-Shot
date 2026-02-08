# Sui Shot

Take a shot, not the risk.

Sui Shot is a no-loss YES/NO lottery + prediction market on Sui where:
- users deposit principal into a round
- principal is returned to all participants at settlement
- only yield is distributed as prize

If you lose the bet, you still get your principal back.
If you win, you get principal + yield prize.

## Why This Matters

Traditional prediction markets and lotteries are zero-sum against users: most players lose principal.

Sui Shot flips the model:
- principal protection by design
- yield-funded rewards
- transparent on-chain accounting

![Sui Shot](workflow-suishot.png)

## Why Sui Is Perfect for This

Sui is a strong fit for no-loss markets because of its object-centric architecture and fast UX.

1. **Shared Objects for Global Market State**
- `PredictionMarket` is a shared object that all users can interact with.
- This makes round creation, betting, and settlement state native on-chain without off-chain coordination.

2. **Programmable Transaction Blocks (PTBs)**
- Frontend can split gas coin and call Move entry functions in one flow for cleaner user transactions.
- This helps keep betting UX simple.

3. **High Throughput + Low Latency UX**
- Round interactions (create, bet, settle, fund yield) feel fast enough for consumer-facing apps.

4. **Typed Assets + Strong Move Safety**
- `Coin<SUI>` and `Balance<SUI>` are explicit and type-safe.
- Principal and yield vaults are separated in contract logic, reducing accounting mistakes.

5. **On-Chain Event Model**
- UI can index events (`RoundCreated`, `BetPlaced`, `RoundSettled`, etc.) directly from chain.
- No mandatory centralized backend required for hackathon MVP.

## Product Modes

Each round supports one of three modes:

1. **Random**
- Winner side is chosen randomly at settlement.

2. **Prediction Market**
- Admin configures token address + target price + comparator.
- Price is fetched from CoinGecko at settlement time.

3. **Manual**
- Admin pre-selects winning side at round creation.
- Winner wallet is still selected by weighted randomness among matching side.

Common behavior in all modes:
- one weighted winner gets the yield prize
- all participants receive principal back automatically

## Architecture Overview

1. User places bet (`YES` or `NO`) into round.
2. Stake enters `principal_vault`.
3. Admin can deploy principal into strategy bucket.
4. Strategy accrues simulated yield based on APR + elapsed time.
5. Admin allocates accrued yield to a specific round.
6. On settle:
- winner gets yield prize
- principals are refunded to all participants

## Move Contract Structure

### Core Module
Path: `/Users/devisha/Projects/sui-zeroloss-prediction-market/sources/zero_loss_prediction_market.move`

Shared objects:
- `PredictionMarket` (global protocol state)
- `RoundMetadata` (question + metadata object per round)

### Supporting Module
Path: `/Users/devisha/Projects/sui-zeroloss-prediction-market/sources/mock_yield_engine.move`

Used for extra testing utilities. Main product flow now uses strategy functions inside `zero_loss_prediction_market`.

## Important Functions (Simple Definitions)

### Market lifecycle
- `create_round(...)`
Creates a new round with close time and mode configuration.

- `place_bet(...)`
Accepts user `Coin<SUI>` stake and records YES/NO position.

- `settle_round(...)`
Finalizes a closed round, selects winning side/winner, pays yield prize, and refunds principal automatically.

### Yield funding
- `fund_yield(...)`
Directly funds a round’s yield pool from an admin-provided coin.

### Strategy (simulated yield vault)
- `set_strategy_apr_bps(...)`
Sets APR (basis points) used by simulated accrual.

- `deploy_principal_to_strategy(...)`
Moves principal from market vault into deployed strategy bucket.

- `recall_principal_from_strategy(...)`
Moves principal back from strategy bucket to market vault.

- `fund_strategy_yield(...)`
Adds real SUI liquidity into strategy yield reserve.

- `accrue_strategy_yield(...)`
Keeper/admin trigger that computes elapsed simulated yield using APR.

- `allocate_strategy_yield_to_round(...)`
Moves accrued strategy yield into a selected round’s prize pool.

### Read helpers
- `market_admin(...)` – returns admin address
- `round_count(...)` – total rounds created
- `get_round_meta(...)` – round state snapshot
- `get_strategy_meta(...)` / `get_strategy_meta_v2(...)` – strategy balances + accrual stats

## Key Events (What UI Uses)

- `RoundCreated`
- `BetPlaced`
- `YieldFunded`
- `RoundSettled`
- `PrincipalReturned`
- `StrategyAprUpdated`
- `StrategyYieldAccrued`
- `StrategyYieldAllocated`

## Current Testnet Deployment (Latest)

- Package ID:
`0xd617a94662b3790eaaa1dfe31e57eb8ce16e94c92ddc0d3f149d7a5615354a2c`

- PredictionMarket (shared object):
`0xc4027f480a3474d02bbdb21dc2690dd7f840c50811b14b23ed4d90b8f4c81377`

- MockYieldEngine (shared object):
`0x222f88c5628cdbf81b4bd305a0367c986333d6155e7f020685a702d4d68df0b7`

## Frontend Setup

Path: `/Users/devisha/Projects/sui-zeroloss-prediction-market/frontend`

Create `.env`:

```env
VITE_SUI_NETWORK=testnet
VITE_PACKAGE_ID=0xd617a94662b3790eaaa1dfe31e57eb8ce16e94c92ddc0d3f149d7a5615354a2c
VITE_MARKET_ID=0xc4027f480a3474d02bbdb21dc2690dd7f840c50811b14b23ed4d90b8f4c81377
VITE_MOCK_YIELD_ENGINE_ID=0x222f88c5628cdbf81b4bd305a0367c986333d6155e7f020685a702d4d68df0b7
VITE_COINGECKO_NETWORK=sui-network
VITE_COINGECKO_API_BASE_URL=https://api.coingecko.com/api/v3/onchain
VITE_COINGECKO_API_KEY=YOUR_COINGECKO_KEY
```

Run:

```bash
npm install
npm run dev
```

## Contract Build + Publish

From repo root:

```bash
sui move build
sui client publish --gas-budget 100000000
```

If publish says package already published:
- remove testnet entry from `/Users/devisha/Projects/sui-zeroloss-prediction-market/Published.toml`
- publish again

Then update frontend `.env` IDs and restart app.

## Exact End-to-End Test Sequence

A full tested script is available at:
`/Users/devisha/Projects/sui-zeroloss-prediction-market/scripts/testnet_flow.sh`

It runs:
1. create round
2. place bet
3. set APR
4. deploy principal
5. fund strategy yield reserve
6. accrue strategy yield
7. allocate yield to round
8. settle round

## Security / Fairness Notes

- Principal and yield accounting are separated.
- Allocation requires accrued limits and funded liquidity.
- Settlement auto-refunds principal to all participants.
- Random selection is pseudo-random for MVP (upgrade to VRF is recommended for production).

## Hackathon Value Proposition

1. **User-safe market design**
No-loss principal logic is the core differentiator.

2. **On-chain transparency**
Round lifecycle, bets, yield, and settlement are verifiable.

3. **Real product UX**
Wallet connect, portfolio tracking, strategy controls, and live chain data.

4. **Extensible strategy architecture**
Current simulated strategy can be swapped for a real lending adapter (SuiLend or other) without changing product concept.

## Next Up

- Replace simulated strategy with live yield adapter
- Add VRF randomness
- Add backend indexer for analytics and leaderboards
- Add automation/keeper service for scheduled accrual and settlement

---

If you share your final demo transactions + screenshots, they can be added in a `Proof of Functionality` section exactly like the OmniLotto style.
