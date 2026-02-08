import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { MARKET_ID, MODULE_NAME, PACKAGE_ID } from '../config/network';
import {
  asBoolean,
  asNumber,
  asRecord,
  collectRoundLike,
  fetchModuleEvents,
  isBetPlaced,
  isRoundCreated,
  isRoundResolved,
  isYieldFunded,
  readField,
} from './chain';

export type OnchainMarket = {
  roundId: number;
  question: string;
  closeTimestampMs: number;
  totalYes: number;
  totalNo: number;
  yieldPool: number;
  resolved: boolean;
  winningSide: number;
  createdBy: string;
  createDigest: string;
  createdAtMs: number;
};

export function useOnchainMarkets() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['onchain-markets', PACKAGE_ID, MARKET_ID],
    queryFn: async (): Promise<OnchainMarket[]> => {
      if (!PACKAGE_ID || !MARKET_ID) return [];

      const baseMap = new Map<number, OnchainMarket>();

      const marketObject = await client.getObject({ id: MARKET_ID, options: { showContent: true } });
      if (marketObject.data?.content && marketObject.data.content.dataType === 'moveObject') {
        const fields = marketObject.data.content.fields as Record<string, unknown>;
        const candidates: Array<Record<string, unknown>> = [];
        collectRoundLike(fields.rounds, candidates);

        for (const r of candidates) {
          const roundId = asNumber(readField(r, 'round_id', 'roundId'));
          if (!Number.isFinite(roundId)) continue;

          baseMap.set(roundId, {
            roundId,
            question: `Round #${roundId}`,
            closeTimestampMs: asNumber(readField(r, 'close_timestamp_ms', 'closeTimestampMs')),
            totalYes: asNumber(readField(r, 'total_yes', 'totalYes')),
            totalNo: asNumber(readField(r, 'total_no', 'totalNo')),
            yieldPool: asNumber(readField(r, 'yield_pool', 'yieldPool')),
            resolved: asBoolean(readField(r, 'resolved', 'resolved')),
            winningSide: asNumber(readField(r, 'winning_side', 'winningSide')),
            createdBy: '',
            createDigest: '',
            createdAtMs: 0,
          });
        }
      }

      const allEvents = await fetchModuleEvents(client, PACKAGE_ID, MODULE_NAME);
      const metadataIds: string[] = [];

      for (const evt of allEvents) {
        if (!isRoundCreated(evt) || !evt.parsedJson) continue;
        const json = evt.parsedJson;
        const roundId = asNumber(readField(json, 'round_id', 'roundId'));
        if (!baseMap.has(roundId)) {
          baseMap.set(roundId, {
            roundId,
            question: `Round #${roundId}`,
            closeTimestampMs: asNumber(readField(json, 'close_timestamp_ms', 'closeTimestampMs')),
            totalYes: 0,
            totalNo: 0,
            yieldPool: 0,
            resolved: false,
            winningSide: 0,
            createdBy: '',
            createDigest: '',
            createdAtMs: 0,
          });
        }
        const market = baseMap.get(roundId);
        if (market && !market.createDigest) {
          market.createDigest = evt.txDigest;
          market.createdBy = evt.sender;
          market.createdAtMs = evt.timestampMs;
        }

        const metadataId = readField(json, 'metadata_id', 'metadataId');
        if (typeof metadataId === 'string') metadataIds.push(metadataId);
      }

      if (metadataIds.length > 0) {
        const objects = await client.multiGetObjects({
          ids: [...new Set(metadataIds)],
          options: { showContent: true },
        });

        for (const obj of objects) {
          if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') continue;
          const fields = asRecord(obj.data.content.fields);
          if (!fields) continue;
          const roundId = asNumber(readField(fields, 'round_id', 'roundId'));
          const market = baseMap.get(roundId);
          if (!market) continue;
          const question = readField(fields, 'question', 'question');
          if (typeof question === 'string' && question.length > 0) market.question = question;
        }
      }

      for (const evt of allEvents) {
        if (!evt.parsedJson) continue;
        const json = evt.parsedJson;
        const roundId = asNumber(readField(json, 'round_id', 'roundId'));
        const market = baseMap.get(roundId);
        if (!market) continue;

        if (isBetPlaced(evt)) {
          const side = asNumber(readField(json, 'side', 'side'));
          const amount = asNumber(readField(json, 'amount', 'amount'));
          if (market.totalYes + market.totalNo === 0) {
            if (side === 1) market.totalYes += amount;
            if (side === 2) market.totalNo += amount;
          }
        }

        if (isYieldFunded(evt)) {
          if (market.yieldPool === 0) {
            market.yieldPool += asNumber(readField(json, 'amount', 'amount'));
          }
        }

        if (isRoundResolved(evt)) {
          market.resolved = true;
          market.winningSide = asNumber(readField(json, 'winning_side', 'winningSide'));
        }
      }

      return Array.from(baseMap.values())
        .filter((m) => Number.isFinite(m.roundId))
        .sort((a, b) => b.roundId - a.roundId);
    },
    refetchInterval: 4_000,
  });
}
