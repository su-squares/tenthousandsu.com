
describe('services/format-balance.js', () => {
  let formatBalanceString: any;
  let formatBalanceForDisplay: any;

  beforeEach(async () => {
    const module = await import('@web3/services/format-balance.js');
    formatBalanceString = module.formatBalanceString;
    formatBalanceForDisplay = module.formatBalanceForDisplay;
  });

  it('should return em dash for null or undefined', () => {
    expect(formatBalanceString(null as any)).toBe('—');
    expect(formatBalanceString(undefined as any)).toBe('—');
    expect(formatBalanceString('')).toBe('—');
  });

  it('should format small values with 5 decimals', () => {
    expect(formatBalanceString('0.123456789')).toBe('0.12345');
    expect(formatBalanceString('0.1')).toBe('0.1');
    expect(formatBalanceString('0.100000')).toBe('0.1');
  });

  it('should show <0.00001 for tiny values', () => {
    expect(formatBalanceString('0.000001')).toBe('<0.00001');
    expect(formatBalanceString('0.0000099')).toBe('<0.00001');
  });

  it('should format zero as 0', () => {
    expect(formatBalanceString('0')).toBe('0');
  });

  it('should format medium values (1-1000) with 4 decimals', () => {
    expect(formatBalanceString('1.234567')).toBe('1.2345');
    expect(formatBalanceString('999.99999')).toBe('999.9999');
  });

  it('should format large values with 2 decimals', () => {
    expect(formatBalanceString('1000.123456')).toBe('1,000.12');
    expect(formatBalanceString('1234567.89')).toBe('1,234,567.88');
  });

  it('should remove trailing zeros', () => {
    expect(formatBalanceString('1.00000')).toBe('1');
    expect(formatBalanceString('1.10000')).toBe('1.1');
    expect(formatBalanceString('1000.00')).toBe('1,000');
  });

  it('should add thousands separators', () => {
    expect(formatBalanceString('1234.5678')).toBe('1,234.56');
    expect(formatBalanceString('1234567.89')).toBe('1,234,567.88');
  });

  describe('formatBalanceForDisplay', () => {
    it('should include symbol and fallback to ETH', () => {
      expect(formatBalanceForDisplay({ formatted: '1.2', symbol: 'DAI' })).toBe('1.2 DAI');
      expect(formatBalanceForDisplay({ formatted: '1.2' })).toBe('1.2 ETH');
    });

    it('should return empty string for null balance', () => {
      expect(formatBalanceForDisplay(null)).toBe('');
    });
  });
});
