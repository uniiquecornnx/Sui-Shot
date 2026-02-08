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

export function buildCreateRoundTx(question: string, closeTimestampMs: bigint) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(30_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_round`,
    arguments: [
      tx.object(MARKET_ID),
      tx.pure.string(question),
      tx.pure.u64(closeTimestampMs),
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

export function buildClaimYieldTx(roundId: number) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(20_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::claim_yield`,
    arguments: [tx.object(MARKET_ID), tx.pure.u64(roundId)],
  });

  return tx;
}

export function buildWithdrawPrincipalTx(roundId: number, side: 1 | 2, amountMist: bigint) {
  assertConfig();
  const tx = new Transaction();
  tx.setGasBudget(20_000_000);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::withdraw_principal`,
    arguments: [tx.object(MARKET_ID), tx.pure.u64(roundId), tx.pure.u8(side), tx.pure.u64(amountMist)],
  });

  return tx;
}
