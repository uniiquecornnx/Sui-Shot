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
};

export function PortfolioPanel({ markets, portfolio }: Props) {
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

  return (
    <section className="panel glass">
      <h3>Your Portfolio</h3>
      <p className="meta">
        Wallet balance: {mistToSui(portfolio?.walletBalance ?? 0)} SUI | Total historically staked: {mistToSui(portfolio?.totalStaked ?? 0)} SUI
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
                  <p className="portfolio-meta">
                    Result side: {market?.winningSide === 1 ? 'YES' : market?.winningSide === 2 ? 'NO' : '-'} | Winner: {market?.winner ? `${market.winner.slice(0, 8)}...${market.winner.slice(-6)}` : '-'}
                  </p>
                  <p className="portfolio-meta">Prize: {mistToSui(market?.prizeAmount ?? 0)} SUI</p>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

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
