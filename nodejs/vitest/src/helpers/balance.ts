export function createMockBalance(
  formatted: string = '1.234567',
  symbol: string = 'ETH',
  decimals: number = 18
) {
  const parts = formatted.split('.');
  const wholePart = parts[0] || '0';
  const decimalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  const valueStr = wholePart + decimalPart;

  return {
    decimals,
    formatted,
    symbol,
    value: BigInt(valueStr)
  };
}

export function createBalanceCacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}
