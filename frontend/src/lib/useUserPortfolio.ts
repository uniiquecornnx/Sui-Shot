import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { MODULE_NAME, PACKAGE_ID } from '../config/network';
import {
  asNumber,
  fetchModuleEvents,
  isBetPlaced,
  isPrincipalWithdrawn,
  isYieldClaimed,
  readField,
} from './chain';

export type UserPosition = {
  roundId: number;
  yes: number;
  no: number;
  total: number;
};

export type UserActivity = {
  digest: string;
  action: 'BET' | 'WITHDRAW' | 'CLAIM';
  roundId: number;
  amount: number;
  side: number;
  timestampMs: number;
};

export type UserPortfolioData = {
  positions: UserPosition[];
  totalStaked: number;
  walletBalance: number;
  history: UserActivity[];
  byRound: Record<number, UserPosition>;
};

export function useUserPortfolio() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ['user-portfolio', account?.address],
    queryFn: async (): Promise<UserPortfolioData> => {
      if (!PACKAGE_ID || !account?.address) {
        return { positions: [], totalStaked: 0, walletBalance: 0, history: [], byRound: {} };
      }

      const [events, balance] = await Promise.all([
        fetchModuleEvents(client, PACKAGE_ID, MODULE_NAME),
        client.getBalance({ owner: account.address }),
      ]);

      const map = new Map<number, UserPosition>();
      const history: UserActivity[] = [];
      const me = account.address.toLowerCase();

      for (const evt of events) {
        if (!evt.parsedJson) continue;
        const json = evt.parsedJson;
        const user = String(readField(json, 'user', 'user') ?? '').toLowerCase();
        if (user !== me) continue;

        const roundId = asNumber(readField(json, 'round_id', 'roundId'));
        const side = asNumber(readField(json, 'side', 'side'));
        const amount = asNumber(readField(json, 'amount', 'amount'));

        if (isBetPlaced(evt)) {
          const row = map.get(roundId) ?? { roundId, yes: 0, no: 0, total: 0 };
          if (side === 1) row.yes += amount;
          if (side === 2) row.no += amount;
          row.total += amount;
          map.set(roundId, row);
          history.push({ digest: evt.txDigest, action: 'BET', roundId, amount, side, timestampMs: evt.timestampMs });
          continue;
        }

        if (isPrincipalWithdrawn(evt)) {
          const row = map.get(roundId) ?? { roundId, yes: 0, no: 0, total: 0 };
          if (side === 1) row.yes = Math.max(0, row.yes - amount);
          if (side === 2) row.no = Math.max(0, row.no - amount);
          row.total = Math.max(0, row.total - amount);
          map.set(roundId, row);
          history.push({ digest: evt.txDigest, action: 'WITHDRAW', roundId, amount, side, timestampMs: evt.timestampMs });
          continue;
        }

        if (isYieldClaimed(evt)) {
          history.push({ digest: evt.txDigest, action: 'CLAIM', roundId, amount, side: 0, timestampMs: evt.timestampMs });
        }
      }

      const positions = Array.from(map.values()).sort((a, b) => b.roundId - a.roundId);
      const totalStaked = positions.reduce((sum, p) => sum + p.total, 0);
      const walletBalance = asNumber(balance.totalBalance);
      const byRound: Record<number, UserPosition> = {};
      for (const p of positions) byRound[p.roundId] = p;

      history.sort((a, b) => b.timestampMs - a.timestampMs);

      return { positions, totalStaked, walletBalance, history, byRound };
    },
    enabled: !!account?.address,
    refetchInterval: 6_000,
  });
}
