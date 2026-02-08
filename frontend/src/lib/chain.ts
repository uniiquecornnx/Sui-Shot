export function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  if (typeof value === 'number') return value !== 0;
  return false;
}

export function readField(json: Record<string, unknown>, snake: string, camel: string): unknown {
  if (snake in json) return json[snake];
  if (camel in json) return json[camel];
  return undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function looksLikeRound(rec: Record<string, unknown>): boolean {
  return (
    ('round_id' in rec || 'roundId' in rec) &&
    ('close_timestamp_ms' in rec || 'closeTimestampMs' in rec)
  );
}

export function collectRoundLike(value: unknown, out: Array<Record<string, unknown>>) {
  if (Array.isArray(value)) {
    for (const v of value) collectRoundLike(v, out);
    return;
  }

  const rec = asRecord(value);
  if (!rec) return;
  if (looksLikeRound(rec)) out.push(rec);

  for (const v of Object.values(rec)) collectRoundLike(v, out);
}

export type ParsedEvent = {
  type: string;
  parsedJson: Record<string, unknown> | null;
  txDigest: string;
  sender: string;
  timestampMs: number;
};

export function isRoundCreated(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::RoundCreated')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    (readField(j, 'round_id', 'roundId') !== undefined) &&
    (readField(j, 'close_timestamp_ms', 'closeTimestampMs') !== undefined) &&
    (readField(j, 'metadata_id', 'metadataId') !== undefined)
  );
}

export function isBetPlaced(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::BetPlaced')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    readField(j, 'round_id', 'roundId') !== undefined &&
    readField(j, 'side', 'side') !== undefined &&
    readField(j, 'amount', 'amount') !== undefined &&
    readField(j, 'user', 'user') !== undefined
  );
}

export function isYieldFunded(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::YieldFunded')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    readField(j, 'round_id', 'roundId') !== undefined &&
    readField(j, 'amount', 'amount') !== undefined &&
    readField(j, 'side', 'side') === undefined
  );
}

export function isRoundResolved(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::RoundResolved')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    readField(j, 'round_id', 'roundId') !== undefined &&
    readField(j, 'winning_side', 'winningSide') !== undefined
  );
}

export function isPrincipalWithdrawn(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::PrincipalWithdrawn')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    readField(j, 'round_id', 'roundId') !== undefined &&
    readField(j, 'side', 'side') !== undefined &&
    readField(j, 'amount', 'amount') !== undefined &&
    readField(j, 'user', 'user') !== undefined
  );
}

export function isYieldClaimed(evt: ParsedEvent): boolean {
  if (evt.type.endsWith('::YieldClaimed')) return true;
  const j = evt.parsedJson;
  if (!j) return false;
  return (
    readField(j, 'round_id', 'roundId') !== undefined &&
    readField(j, 'amount', 'amount') !== undefined &&
    readField(j, 'user', 'user') !== undefined &&
    readField(j, 'side', 'side') === undefined
  );
}

export async function fetchModuleEvents(client: any, packageId: string, module: string) {
  const all: ParsedEvent[] = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  let hasNextPage = true;
  let pages = 0;

  while (hasNextPage && pages < 30) {
    const res: any = await client.queryEvents({
      query: { MoveModule: { package: packageId, module } },
      order: 'ascending',
      cursor,
      limit: 100,
    });

    for (const evt of res.data) {
      const evtAny = evt as unknown as {
        type?: string;
        type_?: string | { module?: string; name?: string; address?: string };
        parsedJson?: unknown;
        id?: { txDigest?: string };
        txDigest?: string;
        sender?: string;
        timestampMs?: string | number;
      };

      const typeFromObj =
        typeof evtAny.type_ === 'object' && evtAny.type_
          ? `${evtAny.type_.address ?? ''}::${evtAny.type_.module ?? ''}::${evtAny.type_.name ?? ''}`
          : '';

      const finalType = evtAny.type || (typeof evtAny.type_ === 'string' ? evtAny.type_ : '') || typeFromObj;

      all.push({
        type: finalType,
        parsedJson: (evtAny.parsedJson ?? null) as Record<string, unknown> | null,
        txDigest: evtAny.id?.txDigest ?? evtAny.txDigest ?? '',
        sender: evtAny.sender ?? '',
        timestampMs: asNumber(evtAny.timestampMs ?? 0),
      });
    }

    cursor = (res.nextCursor as { txDigest: string; eventSeq: string } | null) ?? null;
    hasNextPage = !!res.hasNextPage && !!cursor;
    pages += 1;
  }

  return all;
}
