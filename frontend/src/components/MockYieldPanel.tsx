import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { buildDistributeMockYieldTx } from '../lib/tx';

type Props = {
  defaultRoundId?: number;
  onRefresh: () => void;
};

export function MockYieldPanel({ defaultRoundId = 0, onRefresh }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();

  const [roundId, setRoundId] = useState(String(defaultRoundId));
  const [bps, setBps] = useState('300');
  const [maxSui, setMaxSui] = useState('0.25');
  const [status, setStatus] = useState('');

  async function distribute() {
    if (!account) return setStatus('Connect wallet first.');

    const parsedRound = Number(roundId);
    const parsedBps = Number(bps);
    const parsedMax = Number(maxSui);
    if (!Number.isInteger(parsedRound) || parsedRound < 0) return setStatus('Invalid round id.');
    if (!Number.isFinite(parsedBps) || parsedBps <= 0 || parsedBps > 10_000) return setStatus('BPS must be 1..10000.');
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) return setStatus('Invalid max SUI.');

    try {
      const maxMist = BigInt(Math.floor(parsedMax * 1_000_000_000));
      const tx = buildDistributeMockYieldTx(parsedRound, parsedBps, maxMist);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Mock yield distributed: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  return (
    <section className="panel glass">
      <h3>Mock Yield Engine</h3>
      <p className="hint">Simulate yield and route it to a round prize pool (for testing before SuiLend).</p>

      <div className="form-grid">
        <label htmlFor="yr">Round id</label>
        <input id="yr" value={roundId} onChange={(e) => setRoundId(e.target.value)} inputMode="numeric" />

        <label htmlFor="bps">Yield rate (basis points)</label>
        <input id="bps" value={bps} onChange={(e) => setBps(e.target.value)} inputMode="numeric" />

        <label htmlFor="max">Max distribute (SUI)</label>
        <input id="max" value={maxSui} onChange={(e) => setMaxSui(e.target.value)} inputMode="decimal" />
      </div>

      <button className="btn-yield" disabled={isPending} onClick={distribute}>Distribute Mock Yield</button>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
