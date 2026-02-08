import type { OnchainMarket } from '../lib/useOnchainMarkets';

function mistToSui(value: number): string {
  return (value / 1_000_000_000).toFixed(3);
}

type Props = {
  markets: OnchainMarket[];
  chainAdmin: string;
};

export function StrategyPanel({ markets, chainAdmin }: Props) {
  const totalPrincipal = markets.reduce((sum, m) => sum + m.totalYes + m.totalNo, 0);
  const totalYield = markets.reduce((sum, m) => sum + m.yieldPool, 0);

  return (
    <section className="panel glass">
      <h3>Yield Strategy (SuiLend)</h3>
      <p className="hint">Target strategy: deposit pooled SUI principal into SuiLend SUI reserve, route earned yield back to round prize pools.</p>

      <div className="strategy-grid">
        <div className="strategy-card">
          <p className="portfolio-q">Current Principal Held</p>
          <p className="portfolio-meta">{mistToSui(totalPrincipal)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Current Prize Yield Pools</p>
          <p className="portfolio-meta">{mistToSui(totalYield)} SUI</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">On-chain Admin</p>
          <p className="portfolio-meta">{chainAdmin || 'unknown'}</p>
        </div>
        <div className="strategy-card">
          <p className="portfolio-q">Automation Status</p>
          <p className="portfolio-meta">Direct funding live. SuiLend automation not integrated yet.</p>
        </div>
      </div>

      <h4 className="portfolio-heading">What Works Right Now</h4>
      <ul>
        <li>Users place bets and principal is held safely in-market.</li>
        <li>Yield can be distributed directly to rounds by admin funding.</li>
        <li>Portfolio and round-level tracking is live from chain events.</li>
      </ul>

      <h4 className="portfolio-heading">To Fully Automate with SuiLend</h4>
      <ul>
        <li>Add Move adapter functions to move principal from market vault to SuiLend reserves and back.</li>
        <li>Keep a liquidity buffer for withdrawals (avoid 100% utilization withdraw failures).</li>
        <li>Run scheduled rebalance/harvest jobs and route realized yield to `fund_yield` per round.</li>
      </ul>
    </section>
  );
}
