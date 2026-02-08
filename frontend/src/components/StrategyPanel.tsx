import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import {
  buildAccrueStrategyYieldTx,
  buildAllocateStrategyYieldToRoundTx,
  buildDeployPrincipalToStrategyTx,
  buildFundStrategyYieldTx,
  buildRecallPrincipalFromStrategyTx,
  buildSetStrategyAprTx,
} from '../lib/tx';
import type { OnchainMarket } from '../lib/useOnchainMarkets';
import { useStrategyState } from '../lib/useStrategyState';

function mistToSui(value: number): string {
  return (value / 1_000_000_000).toFixed(3);
}

type Props = {
  markets: OnchainMarket[];
  chainAdmin: string;
  canManage: boolean;
  onRefresh: () => void;
};

export function StrategyPanel({ markets, chainAdmin, canManage, onRefresh }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const { data: strategy } = useStrategyState();
  const [deployAmount, setDeployAmount] = useState('0.5');
  const [recallAmount, setRecallAmount] = useState('0.2');
  const [fundAmount, setFundAmount] = useState('0.05');
  const [allocateRoundId, setAllocateRoundId] = useState(markets[0]?.roundId?.toString() ?? '0');
  const [allocateAmount, setAllocateAmount] = useState('0.01');
  const [aprBps, setAprBps] = useState('350');
  const [status, setStatus] = useState('');

  const totalRoundYieldPool = markets.reduce((sum, m) => sum + m.yieldPool, 0);

  function toMist(value: string): bigint {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter a positive SUI amount.');
    return BigInt(Math.floor(parsed * 1_000_000_000));
  }

  async function run(action: 'deploy' | 'recall' | 'fund' | 'allocate') {
    if (!account) return setStatus('Connect wallet first.');
    try {
      let tx;
      if (action === 'deploy') {
        tx = buildDeployPrincipalToStrategyTx(toMist(deployAmount));
      } else if (action === 'recall') {
        tx = buildRecallPrincipalFromStrategyTx(toMist(recallAmount));
      } else if (action === 'fund') {
        tx = buildFundStrategyYieldTx(toMist(fundAmount));
      } else {
        const roundId = Number(allocateRoundId);
        if (!Number.isFinite(roundId) || roundId < 0) throw new Error('Enter a valid round id.');
        tx = buildAllocateStrategyYieldToRoundTx(roundId, toMist(allocateAmount));
      }
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Transaction sent: ${result.digest}`);
      await onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  async function accrueNow() {
    if (!account) return setStatus('Connect wallet first.');
    try {
      const tx = buildAccrueStrategyYieldTx();
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`Accrued: ${result.digest}`);
      await onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  async function updateApr() {
    if (!account) return setStatus('Connect wallet first.');
    try {
      const bps = Number(aprBps);
      if (!Number.isFinite(bps) || bps < 0) throw new Error('APR bps must be 0 or greater.');
      const tx = buildSetStrategyAprTx(Math.floor(bps));
      const result = await signAndExecuteTransaction({ transaction: tx as any });
      setStatus(`APR updated: ${result.digest}`);
      await onRefresh();
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  return (
    <section className="panel glass">
      <h3>Yield Strategy Pipeline</h3>
      <p className="hint">Transparent simulated accrual is live: deployed principal accrues by APR over time, keeper syncs accrual, then admin allocates accrued yield to rounds.</p>

      <div className="strategy-grid">
        <div className="strategy-card">
          <p className="portfolio-q">Principal in Market Vault</p>
          <p className="portfolio-meta">{mistToSui(strategy?.principalVault ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Principal Deployed to Strategy</p>
          <p className="portfolio-meta">{mistToSui(strategy?.deployedPrincipal ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Strategy Yield Reserve</p>
          <p className="portfolio-meta">{mistToSui(strategy?.strategyYieldVault ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Round Yield Vault</p>
          <p className="portfolio-meta">{mistToSui(strategy?.roundYieldVault ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Yield in Active Rounds</p>
          <p className="portfolio-meta">{mistToSui(totalRoundYieldPool)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Strategy Yield Funded / Allocated</p>
          <p className="portfolio-meta">
            {mistToSui(strategy?.totalStrategyYieldFunded ?? 0)} / {mistToSui(strategy?.totalStrategyYieldAllocated ?? 0)} SUI
          </p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Simulated APR</p>
          <p className="portfolio-meta">{((strategy?.strategyAprBps ?? 0) / 100).toFixed(2)}%</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Accrued Available</p>
          <p className="portfolio-meta">{mistToSui(strategy?.strategyAccruedAvailable ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Total Simulated Accrued</p>
          <p className="portfolio-meta">{mistToSui(strategy?.strategyTotalAccrued ?? 0)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Last Accrual Sync</p>
          <p className="portfolio-meta">
            {(strategy?.strategyLastAccrualMs ?? 0) > 0
              ? new Date(strategy?.strategyLastAccrualMs ?? 0).toLocaleString()
              : 'Not synced yet'}
          </p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">On-chain Admin</p>
          <p className="portfolio-meta">{chainAdmin || 'unknown'}</p>
        </div>
      </div>

      {canManage ? (
        <>
          <h4 className="portfolio-heading">Admin Strategy Actions</h4>
          <div className="portfolio-actions">
            <div className="action-card">
              <p className="portfolio-q">Deploy Principal</p>
              <input value={deployAmount} onChange={(e) => setDeployAmount(e.target.value)} inputMode="decimal" />
              <button className="btn-yield" disabled={isPending} onClick={() => run('deploy')}>Deploy</button>
            </div>
            <div className="action-card">
              <p className="portfolio-q">Recall Principal</p>
              <input value={recallAmount} onChange={(e) => setRecallAmount(e.target.value)} inputMode="decimal" />
              <button className="btn-yield" disabled={isPending} onClick={() => run('recall')}>Recall</button>
            </div>
            <div className="action-card">
              <p className="portfolio-q">Fund Strategy Yield</p>
              <input value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} inputMode="decimal" />
              <button className="btn-yield" disabled={isPending} onClick={() => run('fund')}>Fund</button>
            </div>
            <div className="action-card">
              <p className="portfolio-q">Allocate Yield to Round</p>
              <input value={allocateRoundId} onChange={(e) => setAllocateRoundId(e.target.value)} inputMode="numeric" placeholder="Round id" />
              <input value={allocateAmount} onChange={(e) => setAllocateAmount(e.target.value)} inputMode="decimal" placeholder="SUI amount" />
              <button className="btn-yield" disabled={isPending} onClick={() => run('allocate')}>Allocate</button>
            </div>
            <div className="action-card">
              <p className="portfolio-q">Set Simulated APR (bps)</p>
              <input value={aprBps} onChange={(e) => setAprBps(e.target.value)} inputMode="numeric" />
              <button className="btn-yield" disabled={isPending} onClick={updateApr}>Update APR</button>
            </div>
            <div className="action-card">
              <p className="portfolio-q">Run Keeper Accrual</p>
              <p className="portfolio-meta">Sync elapsed-time yield into accrued balance.</p>
              <button className="btn-yield" disabled={isPending} onClick={accrueNow}>Accrue Now</button>
            </div>
          </div>
        </>
      ) : null}

      <h4 className="portfolio-heading">SuiLend Adapter Next Step</h4>
      <ul>
        <li>Replace simulated deploy/recall internals with SuiLend reserve deposit and withdraw calls.</li>
        <li>Keep this same panel and map actions to real adapter calls without changing UX.</li>
      </ul>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
