import { Transaction } from '@mysten/sui/transactions';
import {
  CLOCK_OBJECT_ID,
  MARKET_ID,
  MOCK_YIELD_ENGINE_ID,
  MOCK_YIELD_MODULE_NAME,
  MODULE_NAME,
  PACKAGE_ID,
} from '../config/network';

function assertConfig() {
  if (!PACKAGE_ID || !MARKET_ID) {
    throw new Error('Missing VITE_PACKAGE_ID or VITE_MARKET_ID in frontend .env');
  }
}

export function buildPlaceBetTx(roundId: number, side: 1 | 2, amountMist: bigint) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(20_000_000);
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::place_bet`,
    arguments: [
      tx.object(MARKET_ID),
      tx.pure.u64(roundId),
      tx.pure.u8(side),
      stakeCoin,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function buildCreateRoundTx(
  question: string,
  closeTimestampMs: bigint,
  mode: 1 | 2 | 3,
  manualSide: 0 | 1 | 2,
  predictionNetwork: string,
  predictionTokenAddress: string,
  predictionTargetPriceE6: bigint,
  predictionComparator: 0 | 1 | 2,
) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(30_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_round`,
    arguments: [
      tx.object(MARKET_ID),
      tx.pure.string(question),
      tx.pure.u64(closeTimestampMs),
      tx.pure.u8(mode),
      tx.pure.u8(manualSide),
      tx.pure.string(predictionNetwork),
      tx.pure.string(predictionTokenAddress),
      tx.pure.u64(predictionTargetPriceE6),
      tx.pure.u8(predictionComparator),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function buildSettleRoundTx(roundId: number, predictionOutcomeSide: 0 | 1 | 2) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(40_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::settle_round`,
    arguments: [
      tx.object(MARKET_ID),
      tx.pure.u64(roundId),
      tx.pure.u8(predictionOutcomeSide),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function buildFundYieldTx(roundId: number, amountMist: bigint) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(20_000_000);
  const [yieldCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::fund_yield`,
    arguments: [tx.object(MARKET_ID), tx.pure.u64(roundId), yieldCoin],
  });

  return tx;
}

export function buildDistributeMockYieldTx(roundId: number, basisPoints: number, maxAmountMist: bigint) {
  assertConfig();
  if (!MOCK_YIELD_ENGINE_ID) {
    throw new Error('Missing VITE_MOCK_YIELD_ENGINE_ID in frontend .env');
  }

  const tx = new Transaction();
  tx.setGasBudget(30_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MOCK_YIELD_MODULE_NAME}::distribute_mock_yield`,
    arguments: [
      tx.object(MOCK_YIELD_ENGINE_ID),
      tx.object(MARKET_ID),
      tx.pure.u64(roundId),
      tx.pure.u64(basisPoints),
      tx.pure.u64(maxAmountMist),
    ],
  });

  return tx;
}

export function buildDepositMockReserveTx(amountMist: bigint) {
  assertConfig();
  if (!MOCK_YIELD_ENGINE_ID) {
    throw new Error('Missing VITE_MOCK_YIELD_ENGINE_ID in frontend .env');
  }

  const tx = new Transaction();
  tx.setGasBudget(20_000_000);
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MOCK_YIELD_MODULE_NAME}::deposit_reserve`,
    arguments: [tx.object(MOCK_YIELD_ENGINE_ID), coin],
  });

  return tx;
}
