import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { buildClaimYieldTx, buildWithdrawPrincipalTx } from '../lib/tx';
import type { OnchainMarket } from '../lib/useOnchainMarkets';
import type { UserPortfolioData } from '../lib/useUserPortfolio';

function mistToSui(value: number): string {
  return (value / 1_000_000_000).toFixed(3);
}

function explorerLink(digest: string): string {
  return `https://suiexplorer.com/txblock/${digest}?network=testnet`;
}

type Props = {
  markets: OnchainMarket[];
  portfolio: UserPortfolioData | undefined;
  onRefresh: () => void;
};

export function PortfolioPanel({ markets, portfolio, onRefresh }: Props) {
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const [withdrawRound, setWithdrawRound] = useState('');
  const [withdrawSide, setWithdrawSide] = useState<'1' | '2'>('1');
  const [withdrawAmount, setWithdrawAmount] = useState('0.05');
  const [claimRound, setClaimRound] = useState('');
  const [status, setStatus] = useState('');

  const positions = portfolio?.positions ?? [];
  const history = portfolio?.history ?? [];
  const marketByRound = new Map(markets.map((m) => [m.roundId, m]));

  const open = positions.filter((p) => {
    const m = marketByRound.get(p.roundId);
    return m ? !m.resolved : true;
  });

  const closed = positions.filter((p) => {
    const m = marketByRound.get(p.roundId);
    return m ? m.resolved : false;
  });

  async function claimYield() {
    const round = Number(claimRound);
    if (!Number.isInteger(round) || round < 0) return setStatus('Enter a valid round id for claim.');

    try {
      const tx = buildClaimYieldTx(round);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Yield claimed: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Claim failed: ${(error as Error).message}`);
    }
  }

  async function withdrawPrincipal() {
    const round = Number(withdrawRound);
    const amount = Number(withdrawAmount);
    if (!Number.isInteger(round) || round < 0) return setStatus('Enter a valid round id for withdrawal.');
    if (!Number.isFinite(amount) || amount <= 0) return setStatus('Enter a valid withdrawal amount.');

    try {
      const amountMist = BigInt(Math.floor(amount * 1_000_000_000));
      const tx = buildWithdrawPrincipalTx(round, withdrawSide === '1' ? 1 : 2, amountMist);
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Principal withdrawn: ${result.digest}`);
      onRefresh();
    } catch (error) {
      setStatus(`Withdraw failed: ${(error as Error).message}`);
    }
  }

  return (
    <section className="panel glass">
      <h3>Your Portfolio</h3>
      <p className="meta">
        Wallet balance: {mistToSui(portfolio?.walletBalance ?? 0)} SUI | Total staked: {mistToSui(portfolio?.totalStaked ?? 0)} SUI
      </p>

      {positions.length === 0 ? <p className="hint">No bets found for connected wallet yet.</p> : null}

      {open.length > 0 ? (
        <>
          <h4 className="portfolio-heading">Open Bets</h4>
          <div className="portfolio-list">
            {open.map((p) => {
              const market = marketByRound.get(p.roundId);
              return (
                <div key={`o-${p.roundId}`} className="portfolio-row">
                  <p className="portfolio-q">{market?.question ?? `Round #${p.roundId}`}</p>
                  <p className="portfolio-meta">
                    YES: {mistToSui(p.yes)} | NO: {mistToSui(p.no)} | Total: {mistToSui(p.total)} SUI
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {closed.length > 0 ? (
        <>
          <h4 className="portfolio-heading">Previous Bets</h4>
          <div className="portfolio-list">
            {closed.map((p) => {
              const market = marketByRound.get(p.roundId);
              return (
                <div key={`c-${p.roundId}`} className="portfolio-row">
                  <p className="portfolio-q">{market?.question ?? `Round #${p.roundId}`}</p>
                  <p className="portfolio-meta">
                    YES: {mistToSui(p.yes)} | NO: {mistToSui(p.no)} | Total: {mistToSui(p.total)} SUI
                  </p>
                  <p className="portfolio-meta">Result: {market?.winningSide === 1 ? 'YES' : market?.winningSide === 2 ? 'NO' : '-'}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <h4 className="portfolio-heading">Actions</h4>
      <div className="portfolio-actions">
        <div className="action-card">
          <p className="portfolio-q">Withdraw Principal</p>
          <input placeholder="Round id" value={withdrawRound} onChange={(e) => setWithdrawRound(e.target.value)} />
          <select value={withdrawSide} onChange={(e) => setWithdrawSide(e.target.value as '1' | '2')}>
            <option value="1">YES side</option>
            <option value="2">NO side</option>
          </select>
          <input placeholder="Amount (SUI)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          <button className="btn-yield" disabled={isPending} onClick={withdrawPrincipal}>Withdraw</button>
        </div>

        <div className="action-card">
          <p className="portfolio-q">Claim Yield</p>
          <input placeholder="Round id" value={claimRound} onChange={(e) => setClaimRound(e.target.value)} />
          <button className="btn-yield" disabled={isPending} onClick={claimYield}>Claim</button>
        </div>
      </div>

      {status ? <p className="status">{status}</p> : null}

      <h4 className="portfolio-heading">Transaction History</h4>
      {history.length === 0 ? (
        <p className="hint">No activity yet.</p>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Round</th>
                <th>Amount</th>
                <th>Digest</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={`${h.digest}-${h.action}-${h.roundId}-${h.timestampMs}`}>
                  <td>{h.timestampMs ? new Date(h.timestampMs).toLocaleString() : '-'}</td>
                  <td>{h.action}</td>
                  <td>{h.roundId}</td>
                  <td>{mistToSui(h.amount)} SUI</td>
                  <td>
                    <a href={explorerLink(h.digest)} target="_blank" rel="noreferrer">
                      {h.digest.slice(0, 8)}...{h.digest.slice(-6)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
