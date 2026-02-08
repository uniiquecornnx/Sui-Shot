export const NETWORK =
  (import.meta.env.VITE_SUI_NETWORK as 'testnet' | 'devnet' | 'mainnet' | undefined) ?? 'testnet';

export const PACKAGE_ID = (import.meta.env.VITE_PACKAGE_ID as string | undefined) ?? '';
export const MARKET_ID = (import.meta.env.VITE_MARKET_ID as string | undefined) ?? '';
export const MOCK_YIELD_ENGINE_ID = (import.meta.env.VITE_MOCK_YIELD_ENGINE_ID as string | undefined) ?? '';
export const COINGECKO_API_KEY = (import.meta.env.VITE_COINGECKO_API_KEY as string | undefined) ?? '';

export const CLOCK_OBJECT_ID = '0x6';
export const MODULE_NAME = 'zero_loss_prediction_market';
export const MOCK_YIELD_MODULE_NAME = 'mock_yield_engine';
