import { COINGECKO_API_BASE_URL, COINGECKO_API_KEY, COINGECKO_NETWORK } from '../config/network';

export async function fetchTokenUsdPrice(tokenAddress: string, networkOverride?: string): Promise<number> {
  if (!COINGECKO_API_KEY) {
    throw new Error('Missing VITE_COINGECKO_API_KEY in frontend .env');
  }

  const normalizedNetwork = (networkOverride ?? '').trim() || COINGECKO_NETWORK.trim();
  const normalizedAddress = tokenAddress.trim().toLowerCase();
  if (!normalizedNetwork) {
    throw new Error('Missing CoinGecko network. Set VITE_COINGECKO_NETWORK in frontend .env');
  }
  if (!normalizedAddress) {
    throw new Error('Prediction token address is required');
  }

  const baseUrl = COINGECKO_API_BASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/simple/networks/${encodeURIComponent(
    normalizedNetwork
  )}/token_price/${encodeURIComponent(normalizedAddress)}`;
  const isProHost = baseUrl.includes('pro-api.coingecko.com');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (COINGECKO_API_KEY) {
    headers[isProHost ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = COINGECKO_API_KEY;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CoinGecko request failed (${response.status}): ${body.slice(0, 280)}`);
  }

  const data = (await response.json()) as {
    data?: { attributes?: { token_prices?: Record<string, string> } };
  };

  const prices = data?.data?.attributes?.token_prices ?? {};
  const key = Object.keys(prices).find((k) => k.toLowerCase() === normalizedAddress);
  if (!key) {
    throw new Error('Token price not found in CoinGecko response');
  }

  const price = Number(prices[key]);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Invalid token price returned by CoinGecko');
  }

  return price;
}
