import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { MARKET_ID } from '../config/network';
import { asNumber, asRecord, readField } from './chain';

export type StrategyState = {
  principalVault: number;
  deployedPrincipal: number;
  strategyYieldVault: number;
  roundYieldVault: number;
  totalStrategyYieldFunded: number;
  totalStrategyYieldAllocated: number;
  strategyAprBps: number;
  strategyLastAccrualMs: number;
  strategyAccruedAvailable: number;
  strategyTotalAccrued: number;
};

const EMPTY: StrategyState = {
  principalVault: 0,
  deployedPrincipal: 0,
  strategyYieldVault: 0,
  roundYieldVault: 0,
  totalStrategyYieldFunded: 0,
  totalStrategyYieldAllocated: 0,
  strategyAprBps: 0,
  strategyLastAccrualMs: 0,
  strategyAccruedAvailable: 0,
  strategyTotalAccrued: 0,
};

function readBalanceValue(raw: unknown): number {
  const rec = asRecord(raw);
  if (!rec) return 0;
  return asNumber(readField(rec, 'value', 'value'));
}

export function useStrategyState() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['strategy-state', MARKET_ID],
    queryFn: async (): Promise<StrategyState> => {
      if (!MARKET_ID) return EMPTY;
      const obj = await client.getObject({ id: MARKET_ID, options: { showContent: true } });
      if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') return EMPTY;
      const fields = asRecord(obj.data.content.fields);
      if (!fields) return EMPTY;

      return {
        principalVault: readBalanceValue(readField(fields, 'principal_vault', 'principalVault')),
        deployedPrincipal: readBalanceValue(readField(fields, 'strategy_principal_deployed', 'strategyPrincipalDeployed')),
        strategyYieldVault: readBalanceValue(readField(fields, 'strategy_yield_vault', 'strategyYieldVault')),
        roundYieldVault: readBalanceValue(readField(fields, 'yield_vault', 'yieldVault')),
        totalStrategyYieldFunded: asNumber(readField(fields, 'strategy_total_yield_funded', 'strategyTotalYieldFunded')),
        totalStrategyYieldAllocated: asNumber(readField(fields, 'strategy_total_yield_allocated', 'strategyTotalYieldAllocated')),
        strategyAprBps: asNumber(readField(fields, 'strategy_apr_bps', 'strategyAprBps')),
        strategyLastAccrualMs: asNumber(readField(fields, 'strategy_last_accrual_ms', 'strategyLastAccrualMs')),
        strategyAccruedAvailable: asNumber(readField(fields, 'strategy_accrued_available', 'strategyAccruedAvailable')),
        strategyTotalAccrued: asNumber(readField(fields, 'strategy_total_accrued', 'strategyTotalAccrued')),
      };
    },
    refetchInterval: 4_000,
  });
}
