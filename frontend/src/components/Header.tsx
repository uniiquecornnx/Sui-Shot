import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

type Props = {
  activeTab: 'markets' | 'portfolio' | 'strategy';
  onTabChange: (tab: 'markets' | 'portfolio' | 'strategy') => void;
};

export function Header({ activeTab, onTabChange }: Props) {
  const account = useCurrentAccount();

  return (
    <header className="header glass">
      <div>
        <p className="eyebrow"></p>
        <h1>🎯 Sui Shot</h1>
        <p className="sub">Take a shot, not the risk. Win from yield, not from losses.</p>
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'markets' ? 'active' : ''}`}
            onClick={() => onTabChange('markets')}
          >
            Markets
          </button>
          <button
            className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
            onClick={() => onTabChange('portfolio')}
          >
            Portfolio
          </button>
          <button
            className={`tab-btn ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => onTabChange('strategy')}
          >
            Yield Strategy
          </button>
        </div>
      </div>
      <div className="wallet-wrap">
        {account ? <p className="connected">Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}</p> : null}
        <ConnectButton />
      </div>
    </header>
  );
}
