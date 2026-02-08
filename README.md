# Zero-Loss Yes/No Prediction Market on Sui

This repo now includes:
- `sources/zero_loss_prediction_market.move` (core market)
- `sources/mock_yield_engine.move` (fake yield simulator for test payouts)
- `frontend/` (interactive UI with wallet connect, live on-chain rounds)

## Core logic

- Users place `YES/NO` bets as principal.
- Principal goes to `principal_vault` (protected).
- Yield goes to `yield_vault` and is distributed to winners only.
- Users can withdraw principal via `withdraw_principal`.
- New rounds are created on-chain and discovered in UI from events.

## Deploy (testnet)

```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market
sui move build
sui client publish --gas-budget 100000000
```

After publish, capture:
- `PACKAGE_ID` (created `package` object)
- `MARKET_ID` (shared object type `::zero_loss_prediction_market::PredictionMarket`)
- `MOCK_YIELD_ENGINE_ID` (shared object type `::mock_yield_engine::MockYieldEngine`)

Your previous publish output was successful. The long integer arrays are bytecode/event bytes, not errors.

## Example contract calls

### Create round
```bash
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function create_round \
  --args $MARKET_ID "Will SUI close above $5 by next Friday?" 1769904000000 0x6 \
  --gas-budget 30000000
```

### Place bet
```bash
# 1 = YES, 2 = NO
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function place_bet \
  --args $MARKET_ID 0 1 0xYOUR_COIN_OBJECT_ID 0x6 \
  --gas-budget 20000000
```

### Fund yield directly
```bash
sui client call \
  --package $PACKAGE_ID \
  --module zero_loss_prediction_market \
  --function fund_yield \
  --args $MARKET_ID 0 0xYOUR_COIN_OBJECT_ID \
  --gas-budget 20000000
```

### Mock yield engine: seed reserve
```bash
sui client call \
  --package $PACKAGE_ID \
  --module mock_yield_engine \
  --function deposit_reserve \
  --args $MOCK_YIELD_ENGINE_ID 0xYOUR_COIN_OBJECT_ID \
  --gas-budget 20000000
```

### Mock yield engine: distribute fake yield to round
```bash
# basis_points=300 means 3%
# max_amount is in MIST (0.25 SUI = 250000000)
sui client call \
  --package $PACKAGE_ID \
  --module mock_yield_engine \
  --function distribute_mock_yield \
  --args $MOCK_YIELD_ENGINE_ID $MARKET_ID 0 300 250000000 \
  --gas-budget 30000000
```

## Frontend

```bash
cd /Users/devisha/Projects/sui-zeroloss-prediction-market/frontend
cp .env.example .env
# fill values from publish output
npm install
npm run dev
```

Set in `frontend/.env`:
- `VITE_SUI_NETWORK=testnet`
- `VITE_PACKAGE_ID=...`
- `VITE_MARKET_ID=...`
- `VITE_MOCK_YIELD_ENGINE_ID=...`

Features:
- Wallet connect
- Create new bet rounds (on-chain)
- Add bets to existing round pools (on-chain)
- Add yield to prize pool (on-chain)
- Trigger mock yield distribution from engine (on-chain)
- Auto-load rounds from chain events
