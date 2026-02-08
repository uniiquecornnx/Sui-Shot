import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { buildCreateRoundTx } from '../lib/tx';

type Props = {
  onRefresh: () => void;
};

function defaultCloseIso() {
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const off = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CreateRoundForm({ onRefresh }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();

  const [question, setQuestion] = useState('Will SUI close above $5 by next Friday?');
  const [closeIso, setCloseIso] = useState(defaultCloseIso());
  const [status, setStatus] = useState('');

  async function createRound() {
    if (!account) return setStatus('Connect wallet first.');
    if (!question.trim()) return setStatus('Question is required.');

    const closeMs = new Date(closeIso).getTime();
    if (!Number.isFinite(closeMs) || closeMs <= Date.now()) {
      return setStatus('Choose a future close time.');
    }

    try {
      const tx = buildCreateRoundTx(question.trim(), BigInt(closeMs));
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Round created: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  return (
    <section className="panel glass">
      <h3>Create New Bet Round</h3>
      <p className="hint">Create a new YES/NO market question directly on-chain.</p>

      <div className="form-grid">
        <label htmlFor="q">Question</label>
        <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} />

        <label htmlFor="close">Close time</label>
        <input id="close" type="datetime-local" value={closeIso} onChange={(e) => setCloseIso(e.target.value)} />
      </div>

      <button className="btn-yield" disabled={isPending} onClick={createRound}>Create Round</button>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
