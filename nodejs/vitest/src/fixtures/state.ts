export interface TxState {
  status: 'idle' | 'processing' | 'pending' | 'success' | 'error';
  title: string;
  message: string;
  helpText: string;
  pending: Array<{ hash: string; url?: string }>;
  confirmed: Array<{ hash: string; url?: string }>;
  pricing: {
    mintPriceEth: number;
    personalizePriceEth: number;
  };
  mode: 'mint' | 'personalize' | 'unpersonalize' | 'both';
  personalizeCount: number;
  showPersonalizeTotal: boolean;
  showWalletButton: boolean;
  showBalance: boolean;
  balance: { formatted: string; symbol: string; decimals?: number; value?: bigint } | null;
  balanceLoading: boolean;
  balanceContext: {
    address: string;
    chainId: number;
    fetcher: (address: string, chainId: number) => Promise<any>;
  } | null;
}

export function createMockTxState(overrides: Partial<TxState> = {}): TxState {
  return {
    status: 'idle',
    title: 'Transaction status',
    message: '',
    helpText: '',
    pending: [],
    confirmed: [],
    pricing: {
      mintPriceEth: 0.5,
      personalizePriceEth: 0.001
    },
    mode: 'both',
    personalizeCount: 0,
    showPersonalizeTotal: false,
    showWalletButton: false,
    showBalance: true,
    balance: null,
    balanceLoading: false,
    balanceContext: null,
    ...overrides
  };
}
