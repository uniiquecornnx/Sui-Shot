#!/usr/bin/env bash
set -euo pipefail

# Fill these after publish:
PACKAGE_ID="${PACKAGE_ID:-0xYOUR_PACKAGE_ID}"
MARKET_ID="${MARKET_ID:-0xYOUR_MARKET_OBJECT_ID}"
ROUND_ID="${ROUND_ID:-0}"
CLOSE_TS_MS="${CLOSE_TS_MS:-1769904000000}"
BET_SIDE="${BET_SIDE:-1}" # 1=YES, 2=NO
WINNING_SIDE="${WINNING_SIDE:-1}"
BET_COIN_ID="${BET_COIN_ID:-0xYOUR_BET_COIN_OBJECT}"
YIELD_COIN_ID="${YIELD_COIN_ID:-0xYOUR_YIELD_COIN_OBJECT}"

sui client switch --env testnet

# 1) Create round
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function create_round \
  --args "$MARKET_ID" "Will BTC be above 150k by Jan 2027?" "$CLOSE_TS_MS" 0x6 \
  --gas-budget 20000000

# 2) Place bet
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function place_bet \
  --args "$MARKET_ID" "$ROUND_ID" "$BET_SIDE" "$BET_COIN_ID" 0x6 \
  --gas-budget 20000000

# 3) Fund yield
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function fund_yield \
  --args "$MARKET_ID" "$ROUND_ID" "$YIELD_COIN_ID" \
  --gas-budget 20000000

# 4) Resolve
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function resolve_round \
  --args "$MARKET_ID" "$ROUND_ID" "$WINNING_SIDE" 0x6 \
  --gas-budget 20000000

# 5) Claim yield
sui client call \
  --package "$PACKAGE_ID" \
  --module zero_loss_prediction_market \
  --function claim_yield \
  --args "$MARKET_ID" "$ROUND_ID" \
  --gas-budget 20000000
