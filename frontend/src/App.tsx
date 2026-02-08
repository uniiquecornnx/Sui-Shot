import { useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect, useMemo, useState } from 'react';
import { CreateRoundForm } from './components/CreateRoundForm';
import { Header } from './components/Header';
import { MarketCard } from './components/MarketCard';
import { PortfolioPanel } from './components/PortfolioPanel';
import { StrategyPanel } from './components/StrategyPanel';
import { useMarketAdmin } from './lib/useMarketAdmin';
import { useOnchainMarkets } from './lib/useOnchainMarkets';
import { useUserPortfolio } from './lib/useUserPortfolio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'markets' | 'portfolio' | 'strategy'>('markets');
  const [dismissedRoundIds, setDismissedRoundIds] = useState<number[]>([]);
  const account = useCurrentAccount();
  const { data: markets, isLoading, isError, refetch } = useOnchainMarkets();
  const { data: portfolio, refetch: refetchPortfolio } = useUserPortfolio();
  const { data: chainAdmin } = useMarketAdmin();

  const connected = account?.address?.toLowerCase() ?? '';
  const isChainAdmin = connected !== '' && chainAdmin !== '' && connected === chainAdmin;
  const canRunAdminActions = isChainAdmin;

  const myByRound = portfolio?.byRound ?? {};
  const dismissKey = useMemo(() => `sui-shot-dismissed:${connected || 'guest'}`, [connected]);
  const visibleMarkets = useMemo(
    () => (markets ?? []).filter((m) => !dismissedRoundIds.includes(m.roundId)),
    [markets, dismissedRoundIds]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      if (!raw) {
        setDismissedRoundIds([]);
        return;
      }
      const parsed = JSON.parse(raw) as number[];
      setDismissedRoundIds(Array.isArray(parsed) ? parsed.filter((x) => Number.isFinite(x)) : []);
    } catch {
      setDismissedRoundIds([]);
    }
  }, [dismissKey]);

  function dismissRound(roundId: number) {
    setDismissedRoundIds((prev) => {
      const next = prev.includes(roundId) ? prev : [...prev, roundId];
      localStorage.setItem(dismissKey, JSON.stringify(next));
      return next;
    });
  }

  async function refreshAll() {
    await Promise.all([refetch(), refetchPortfolio()]);
  }

  return (
    <div className="page">
      <div className="decor decor-1" />
      <div className="decor decor-2" />
      <main className="container">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />

        {connected !== '' && !isChainAdmin ? (
          <section className="panel glass">
            <h3>User Mode</h3>
            <p className="hint">
              Connected as user. Admin features are available only for on-chain admin wallet: <code>{chainAdmin || 'unknown'}</code>.
            </p>
          </section>
        ) : null}

        {activeTab === 'markets' ? (
          <>
            {canRunAdminActions ? <CreateRoundForm onRefresh={refreshAll} /> : null}

            {isLoading ? <p className="hint">Loading on-chain rounds...</p> : null}
            {isError ? <p className="hint">Could not load rounds. Check network/wallet.</p> : null}

            <section className="markets-grid">
              {visibleMarkets?.map((market) => (
                <MarketCard
                  market={market}
                  key={market.roundId}
                  onRefresh={refreshAll}
                  onDismiss={() => dismissRound(market.roundId)}
                  myYes={myByRound[market.roundId]?.yes ?? 0}
                  myNo={myByRound[market.roundId]?.no ?? 0}
                  canFundYield={canRunAdminActions}
                  canSettle={canRunAdminActions}
                />
              ))}
            </section>

            {!isLoading && (visibleMarkets?.length ?? 0) === 0 ? (
              <section className="panel glass">
                <h3>No rounds yet</h3>
                <p className="hint">Admin can create the first market round. Users can place bets once a round exists.</p>
              </section>
            ) : null}
          </>
        ) : activeTab === 'portfolio' ? (
          <PortfolioPanel markets={markets ?? []} portfolio={portfolio} />
        ) : (
          <StrategyPanel
            markets={markets ?? []}
            chainAdmin={chainAdmin ?? ''}
            canManage={canRunAdminActions}
            onRefresh={refreshAll}
          />
        )}
      </main>
    </div>
  );
}
