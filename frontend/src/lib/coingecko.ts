import { COINGECKO_API_KEY } from '../config/network';

export async function fetchTokenUsdPrice(network: string, tokenAddress: string): Promise<number> {
  if (!COINGECKO_API_KEY) {
    throw new Error('Missing VITE_COINGECKO_API_KEY in frontend .env');
  }

  const url = `https://pro-api.coingecko.com/api/v3/onchain/simple/networks/${encodeURIComponent(
    network
  )}/token_price/${encodeURIComponent(tokenAddress.toLowerCase())}`;

  const response = await fetch(url, {
    headers: {
      'x-cg-pro-api-key': COINGECKO_API_KEY,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    data?: { attributes?: { token_prices?: Record<string, string> } };
  };

  const prices = data?.data?.attributes?.token_prices ?? {};
  const key = Object.keys(prices).find((k) => k.toLowerCase() === tokenAddress.toLowerCase());
  if (!key) {
    throw new Error('Token price not found in CoinGecko response');
  }

  const price = Number(prices[key]);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Invalid token price returned by CoinGecko');
  }

  return price;
}
