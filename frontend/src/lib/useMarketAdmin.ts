import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { MARKET_ID } from '../config/network';
import { asRecord, readField } from './chain';

export function useMarketAdmin() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['market-admin', MARKET_ID],
    queryFn: async () => {
      if (!MARKET_ID) return '';
      const obj = await client.getObject({ id: MARKET_ID, options: { showContent: true } });
      if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') return '';
      const fields = asRecord(obj.data.content.fields);
      if (!fields) return '';
      const admin = readField(fields, 'admin', 'admin');
      return typeof admin === 'string' ? admin.toLowerCase() : '';
    },
    refetchInterval: 10_000,
  });
}
