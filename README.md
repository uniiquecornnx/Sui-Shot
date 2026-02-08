# Sui Shot

Take a shot, not the risk.

`Sui Shot` is a no-loss YES/NO lottery + prediction market on Sui:
- users place principal on YES/NO
- principal is protected and returned at settlement
- yield (not principal losses) is paid as prize

This repo includes:
- Move contracts in `/Users/devisha/Projects/sui-zeroloss-prediction-market/sources`
- React frontend in `/Users/devisha/Projects/sui-zeroloss-prediction-market/frontend`

## What is implemented

### Core market
- Timed rounds (`open -> closed -> settled`)
- 3 round modes:
  - `Random`
  - `Prediction Market` (off-chain price fetch + on-chain settle signal)
  - `Manual`
- YES/NO staking in SUI
- Weighted winner selection
- Automatic principal return to all users on settle

### Strategy vault (simulated, on-chain accounting)
- Principal can be moved to a strategy bucket by admin
- Transparent APR-based accrual using elapsed time and on-chain clock
- Keeper trigger to accrue simulated yield
- Admin allocates accrued yield to specific rounds
- Round settlement pays prize from allocated yield

### Frontend
- Wallet connect
- Admin round creation
- User betting on YES/NO
- Portfolio view (positions + history)
- Strategy tab with live balances and admin actions

## Contract modules

### 1) `prediction_market::zero_loss_prediction_market`
Path: `/Users/devisha/Projects/sui-zeroloss-prediction-market/sources/zero_loss_prediction_market.move`

Main shared object:
- `PredictionMarket` (admin, rounds, principal/yield vaults, strategy state)

Main entry functions:
- `create_round(...)`
- `place_bet(...)`
- `fund_yield(...)`
- `settle_round(...)`

Strategy entry functions:
- `set_strategy_apr_bps(...)`
- `deploy_principal_to_strategy(...)`
- `recall_principal_from_strategy(...)`
- `fund_strategy_yield(...)`
- `accrue_strategy_yield(...)`
- `allocate_strategy_yield_to_round(...)`

Useful read functions:
- `market_admin(...)`
- `round_count(...)`
- `get_round_meta(...)`
- `get_strategy_meta(...)`
- `get_strategy_meta_v2(...)`

Important events:
- `RoundCreated`
- `BetPlaced`
- `YieldFunded`
- `RoundSettled`
- `PrincipalReturned`
- `StrategyPrincipalDeployed`
- `StrategyPrincipalRecalled`
- `StrategyYieldFunded`
- `StrategyYieldAccrued`
- `StrategyYieldAllocated`

### 2) `prediction_market::mock_yield_engine`
Path: `/Users/devisha/Projects/sui-zeroloss-prediction-market/sources/mock_yield_engine.move`

Used for extra testing/reference. Main UX now uses direct strategy controls in the market module.

## Round modes and settlement behavior

### Mode 1: Random
- winning side randomly picks YES/NO
- winner selected by weighted stake among winning side
- if nobody on winning side, fallback weighted draw among all participants

### Mode 2: Prediction
- admin sets token/network/target/comparator while creating round
- off-chain fetch decides outcome side at settlement call
- contract finalizes winner + returns all principal

### Mode 3: Manual
- admin pre-selects winning side at round creation
- weighted winner draw among that side at settlement

In all modes:
- principal is returned to all participants
- only yield is prize

## Strategy accrual model (simulation)

Accrual is transparent and deterministic:
- inputs: `deployed_principal`, `apr_bps`, `elapsed_ms`
- formula:

`accrued = deployed_principal * apr_bps / 10_000 * elapsed_ms / MS_PER_YEAR`

Where `MS_PER_YEAR = 31,536,000,000`.

Notes:
- accrual updates when keeper/admin triggers `accrue_strategy_yield` (also auto-called in deploy/recall/allocate)
- `allocate_strategy_yield_to_round` requires:
  - enough `strategy_accrued_available`
  - enough funded `strategy_yield_vault` liquidity
- this prevents over-allocation and keeps payout accounting clear

## Architecture (high level)

1. User places bet -> `principal_vault`
2. Admin may deploy principal -> `strategy_principal_deployed`
3. Keeper accrues simulated yield over time
4. Admin funds strategy yield reserve (real SUI liquidity)
5. Admin allocates accrued yield to round
6. On settlement:
   - winner receives yield prize
   - all users get principal back automatically

## Local setup

### Prerequisites
- Sui CLI installed and configured
- Node.js 18+
- npm

### Build contract
```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market
sui move build
```

### Frontend setup
```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market/frontend
cp .env.example .env
npm install
npm run dev
```

## Publish / republish on testnet

### Why you see: "Your package is already published"
Sui tracks publish metadata in:
- `/Users/devisha/Projects/sui-zeroloss-prediction-market/Published.toml`

If you want a fresh publish (new package ID), remove the testnet entry there, then publish.

### Fresh publish
```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market
sui move build
sui client publish --gas-budget 100000000
```

From output `changed_objects`, capture:
- `package` object id -> `VITE_PACKAGE_ID`
- `...::zero_loss_prediction_market::PredictionMarket` shared object id -> `VITE_MARKET_ID`
- `...::mock_yield_engine::MockYieldEngine` shared object id -> `VITE_MOCK_YIELD_ENGINE_ID`

### Update frontend env IDs
Edit:
- `/Users/devisha/Projects/sui-zeroloss-prediction-market/frontend/.env`

Set:
```env
VITE_SUI_NETWORK=testnet
VITE_PACKAGE_ID=0x...
VITE_MARKET_ID=0x...
VITE_MOCK_YIELD_ENGINE_ID=0x...
VITE_COINGECKO_API_KEY=...
```

Restart frontend after update:
```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market/frontend
npm run dev
```

## Exact transaction sequence to test end-to-end

Use admin wallet for admin calls, and one or more user wallets for betting.

Set env vars in terminal first:
```bash
export PACKAGE_ID=0xYOUR_PACKAGE
export MARKET_ID=0xYOUR_MARKET_SHARED_OBJECT
```

### 1) Create a round (Random mode)
```bash
# close time in future (ms). Example value only.
export CLOSE_TS_MS=1769904000000

sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function create_round \
  --args \
    $MARKET_ID \
    "Will SUI be above 3 USD by Friday?" \
    $CLOSE_TS_MS \
    1 \
    0 \
    "" \
    "" \
    0 \
    0 \
    0x6 \
  --gas-budget 40000000
```

### 2) Place user bets
```bash
# user splits gas coin into stake coin implicitly in PTB via frontend.
# For CLI call, pass a real Coin<SUI> object ID as stake.
export ROUND_ID=0
export USER_STAKE_COIN=0xUSER_STAKE_COIN_OBJECT

sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function place_bet \
  --args $MARKET_ID $ROUND_ID 1 $USER_STAKE_COIN 0x6 \
  --gas-budget 30000000
```

### 3) Set APR and deploy principal to strategy
```bash
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function set_strategy_apr_bps \
  --args $MARKET_ID 350 \
  --gas-budget 20000000

# deploy 0.5 SUI = 500000000 mist
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function deploy_principal_to_strategy \
  --args $MARKET_ID 500000000 0x6 \
  --gas-budget 30000000
```

### 4) Fund strategy yield liquidity
```bash
export STRATEGY_YIELD_COIN=0xADMIN_COIN_OBJECT

sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function fund_strategy_yield \
  --args $MARKET_ID $STRATEGY_YIELD_COIN \
  --gas-budget 30000000
```

### 5) Trigger accrual keeper
```bash
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function accrue_strategy_yield \
  --args $MARKET_ID 0x6 \
  --gas-budget 20000000
```

### 6) Allocate accrued yield to round
```bash
# allocate 0.01 SUI = 10000000 mist
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function allocate_strategy_yield_to_round \
  --args $MARKET_ID $ROUND_ID 10000000 0x6 \
  --gas-budget 30000000
```

### 7) After close time, settle round
```bash
# for random/manual mode, prediction_outcome_side=0
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function settle_round \
  --args $MARKET_ID $ROUND_ID 0 0x6 \
  --gas-budget 50000000
```

Expected:
- `RoundSettled` event emitted
- principal auto-return events for all participants
- yield prize sent to selected winner

## Frontend test flow (recommended)

1. Connect admin wallet
2. Create round
3. Connect user wallet(s), place YES/NO bets
4. Admin -> `Yield Strategy` tab:
   - set APR
   - deploy principal
   - fund strategy yield
   - accrue now
   - allocate to round
5. After close time, admin settles
6. User checks `Portfolio` tab for activity and outcomes

## Known constraints / assumptions

- Randomness uses pseudo-random logic (clock + state), not VRF-grade randomness
- Prediction mode currently relies on off-chain fetch + admin settle transaction
- Strategy yield is simulated for hackathon demo; SuiLend adapter can replace internals later
- `public entry` lint warnings are non-blocking and do not prevent deployment

## Hackathon judging notes

### Innovation
- No-loss design: user principal protection + yield-based rewards
- Multi-mode rounds in a single protocol (random, manual, prediction)

### Technical depth
- Shared object market architecture on Sui
- Event-driven frontend indexing
- On-chain strategy accounting and deterministic accrual simulation

### User experience
- Admin/user role separation
- Live market cards and strategy dashboard
- Portfolio transparency (positions + returns + prizes)

### Safety direction
- Principals and prize liquidity are separately tracked
- Allocation constrained by accrued accounting and funded liquidity
- Automatic principal return at settlement

## Future roadmap

- Replace strategy simulation with SuiLend adapter calls
- Add oracle/automation executor for trust-minimized settlement
- Add VRF-based randomness for lottery finalization
- Add indexer backend for faster analytics and historical dashboards
