import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { buildFundYieldTx, buildPlaceBetTx } from '../lib/tx';
import type { OnchainMarket } from '../lib/useOnchainMarkets';

type Props = {
  market: OnchainMarket;
  onRefresh: () => void;
  myYes: number;
  myNo: number;
  canFundYield: boolean;
  chainAdmin: string;
};

function mistToSui(value: number): string {
  return (value / 1_000_000_000).toFixed(3);
}

function short(value: string): string {
  if (!value) return '-';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function MarketCard({ market, onRefresh, myYes, myNo, canFundYield, chainAdmin }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const [betAmount, setBetAmount] = useState('0.1');
  const [yieldAmount, setYieldAmount] = useState('0.02');
  const [status, setStatus] = useState('');

  const totalPool = market.totalYes + market.totalNo;
  const yesPct = totalPool > 0 ? Math.round((market.totalYes / totalPool) * 100) : 50;
  const noPct = 100 - yesPct;

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

  return (
    <article className="market-card glass">
      <div className="card-top">
        <span className="badge">Round #{market.roundId}</span>
        <span className="badge">{market.resolved ? 'Resolved' : 'Open'}</span>
      </div>

      <h2>{market.question}</h2>
      <p className="meta">
        Close: {new Date(market.closeTimestampMs).toLocaleString()} • Principal pool: {mistToSui(totalPool)} SUI
      </p>
      <p className="meta">
        Created by: {short(market.createdBy)} {market.createdBy.toLowerCase() === chainAdmin.toLowerCase() ? '(Admin)' : ''}
      </p>
      <p className="meta">Create digest: {short(market.createDigest)}</p>
      <p className="meta">
        My bet: YES {mistToSui(myYes)} SUI | NO {mistToSui(myNo)} SUI
      </p>

      <div className="odds-wrap">
        <div className="odd yes">YES {yesPct}% ({mistToSui(market.totalYes)} SUI)</div>
        <div className="odd no">NO {noPct}% ({mistToSui(market.totalNo)} SUI)</div>
      </div>

      <p className="meta">Yield pool: {mistToSui(market.yieldPool)} SUI</p>

      <div className="bet-controls">
        <label htmlFor={`amount-${market.roundId}`}>Add bet amount (SUI)</label>
        <input
          id={`amount-${market.roundId}`}
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          inputMode="decimal"
        />
      </div>

      <div className="actions">
        <button disabled={isPending || market.resolved} onClick={() => place(1)} className="btn-yes">Bet YES</button>
        <button disabled={isPending || market.resolved} onClick={() => place(2)} className="btn-no">Bet NO</button>
      </div>

      {canFundYield ? (
        <>
          <div className="bet-controls">
            <label htmlFor={`yield-${market.roundId}`}>Add yield to prize pool (SUI)</label>
            <input
              id={`yield-${market.roundId}`}
              value={yieldAmount}
              onChange={(e) => setYieldAmount(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <button disabled={isPending} onClick={addYield} className="btn-yield">Fund Yield</button>
        </>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
    </article>
  );
}
