#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PACKAGE_ID=0x... MARKET_ID=0x... CLOSE_TS_MS=1769904000000 ./scripts/testnet_flow.sh

PACKAGE_ID="${PACKAGE_ID:-0xYOUR_PACKAGE_ID}"
MARKET_ID="${MARKET_ID:-0xYOUR_MARKET_OBJECT_ID}"
ROUND_ID="${ROUND_ID:-0}"
CLOSE_TS_MS="${CLOSE_TS_MS:-1769904000000}"
QUESTION="${QUESTION:-Will SUI stay above 3 USD by Friday?}"
STAKE_SIDE="${STAKE_SIDE:-1}" # 1=YES, 2=NO
STAKE_COIN_ID="${STAKE_COIN_ID:-0xYOUR_STAKE_COIN_OBJECT}"
STRATEGY_YIELD_COIN_ID="${STRATEGY_YIELD_COIN_ID:-0xYOUR_STRATEGY_YIELD_COIN_OBJECT}"
APR_BPS="${APR_BPS:-350}"
DEPLOY_MIST="${DEPLOY_MIST:-500000000}" # 0.5 SUI
ALLOCATE_MIST="${ALLOCATE_MIST:-10000000}" # 0.01 SUI
PREDICTION_OUTCOME_SIDE="${PREDICTION_OUTCOME_SIDE:-0}" # 0 for random/manual rounds

sui client switch --env testnet

echo "1) create round"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function create_round \
  --args "$MARKET_ID" "$QUESTION" "$CLOSE_TS_MS" 1 0 "" "" 0 0 0x6 \
  --gas-budget 40000000

echo "2) place bet"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function place_bet \
  --args "$MARKET_ID" "$ROUND_ID" "$STAKE_SIDE" "$STAKE_COIN_ID" 0x6 \
  --gas-budget 30000000

echo "3) set apr"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function set_strategy_apr_bps \
  --args "$MARKET_ID" "$APR_BPS" \
  --gas-budget 20000000

echo "4) deploy principal"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function deploy_principal_to_strategy \
  --args "$MARKET_ID" "$DEPLOY_MIST" 0x6 \
  --gas-budget 30000000

echo "5) fund strategy yield reserve"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function fund_strategy_yield \
  --args "$MARKET_ID" "$STRATEGY_YIELD_COIN_ID" \
  --gas-budget 30000000

echo "6) accrue simulated yield"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function accrue_strategy_yield \
  --args "$MARKET_ID" 0x6 \
  --gas-budget 20000000

echo "7) allocate accrued yield to round"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function allocate_strategy_yield_to_round \
  --args "$MARKET_ID" "$ROUND_ID" "$ALLOCATE_MIST" 0x6 \
  --gas-budget 30000000

echo "8) wait until close time, then settle"
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function settle_round \
  --args "$MARKET_ID" "$ROUND_ID" "$PREDICTION_OUTCOME_SIDE" 0x6 \
  --gas-budget 50000000

echo "done"
