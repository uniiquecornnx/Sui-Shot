import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { buildFundYieldTx, buildPlaceBetTx, buildSettleRoundTx } from '../lib/tx';
import type { OnchainMarket } from '../lib/useOnchainMarkets';

type Props = {
  market: OnchainMarket;
  onRefresh: () => void;
  myYes: number;
  myNo: number;
  canFundYield: boolean;
  canSettle: boolean;
};

function mistToSui(value: number): string {
  return (value / 1_000_000_000).toFixed(3);
}

export function MarketCard({ market, onRefresh, myYes, myNo, canFundYield, canSettle }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const [betAmount, setBetAmount] = useState('0.1');
  const [yieldAmount, setYieldAmount] = useState('0.02');
  const [predictionOutcome, setPredictionOutcome] = useState<'1' | '2'>('1');
  const [status, setStatus] = useState('');

  const totalPool = market.totalYes + market.totalNo;
  const yesPct = totalPool > 0 ? Math.round((market.totalYes / totalPool) * 100) : 50;
  const noPct = 100 - yesPct;

  const now = Date.now();
  const isClosedTime = now >= market.closeTimestampMs;
  const cardState = market.resolved ? 'Past' : isClosedTime ? 'Closed' : 'Open';

  async function place(side: 1 | 2) {
    if (!account) return setStatus('Connect wallet first.');
    const parsed = Number(betAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return setStatus('Invalid bet amount.');

    try {
      const amountMist = BigInt(Math.floor(parsed * 1_000_000_000));
      const tx = buildPlaceBetTx(market.roundId, side, amountMist);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Bet placed: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  async function addYield() {
    if (!account) return setStatus('Connect wallet first.');
    const parsed = Number(yieldAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return setStatus('Invalid yield amount.');

    try {
      const amountMist = BigInt(Math.floor(parsed * 1_000_000_000));
      const tx = buildFundYieldTx(market.roundId, amountMist);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Yield funded: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  async function settleRound() {
    try {
      const outcome = market.mode === 2 ? (Number(predictionOutcome) as 1 | 2) : 0;
      const tx = buildSettleRoundTx(market.roundId, outcome as 0 | 1 | 2);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Round settled: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Settle failed: ${(error as Error).message}`);
    }
  }

  return (
    <article className="market-card glass">
      <div className="card-top">
        <span className="badge">Round #{market.roundId}</span>
        <span className="badge">{cardState}</span>
      </div>

      <h2>{market.question}</h2>
      <p className="meta">Closing: {new Date(market.closeTimestampMs).toLocaleString()}</p>
      <p className="meta">Pool: {mistToSui(totalPool)} SUI | Yield: {mistToSui(market.yieldPool)} SUI</p>
      <p className="meta">My bet: YES {mistToSui(myYes)} | NO {mistToSui(myNo)} SUI</p>

      <div className="odds-wrap">
        <div className="odd yes">YES {yesPct}% ({mistToSui(market.totalYes)} SUI)</div>
        <div className="odd no">NO {noPct}% ({mistToSui(market.totalNo)} SUI)</div>
      </div>

      {market.resolved ? <p className="meta">Winner prize paid: {mistToSui(market.prizeAmount)} SUI</p> : null}

      <div className="bet-controls">
        <label htmlFor={`amount-${market.roundId}`}>Bet amount (SUI)</label>
        <input
          id={`amount-${market.roundId}`}
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          inputMode="decimal"
        />
      </div>

      <div className="actions">
        <button disabled={isPending || market.resolved || isClosedTime} onClick={() => place(1)} className="btn-yes">Bet YES</button>
        <button disabled={isPending || market.resolved || isClosedTime} onClick={() => place(2)} className="btn-no">Bet NO</button>
      </div>

      {canFundYield ? (
        <>
          <div className="bet-controls">
            <label htmlFor={`yield-${market.roundId}`}>Add yield (SUI)</label>
            <input
              id={`yield-${market.roundId}`}
              value={yieldAmount}
              onChange={(e) => setYieldAmount(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <button disabled={isPending || market.resolved} onClick={addYield} className="btn-yield">Fund Yield</button>
        </>
      ) : null}

      {canSettle && !market.resolved && isClosedTime ? (
        <>
          {market.mode === 2 ? (
            <div className="bet-controls">
              <label htmlFor={`outcome-${market.roundId}`}>Prediction outcome</label>
              <select
                id={`outcome-${market.roundId}`}
                value={predictionOutcome}
                onChange={(e) => setPredictionOutcome(e.target.value as '1' | '2')}
              >
                <option value="1">YES</option>
                <option value="2">NO</option>
              </select>
            </div>
          ) : null}
          <button disabled={isPending} onClick={settleRound} className="btn-yield">Trigger Draw / Settle</button>
        </>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
    </article>
  );
}
