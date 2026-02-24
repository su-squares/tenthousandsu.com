/**
 * Mock contract addresses for testing
 */
export const MOCK_CONTRACT_ADDRESSES = {
  mainnet: {
    primary: '0x1111111111111111111111111111111111111111',
    underlay: '0x2222222222222222222222222222222222222222'
  },
  sepolia: {
    primary: '0x3333333333333333333333333333333333333333',
    underlay: '0x4444444444444444444444444444444444444444'
  },
  sunet: {
    primary: '0x5555555555555555555555555555555555555555',
    underlay: '0x6666666666666666666666666666666666666666'
  }
};

/**
 * Create partial contract addresses for testing
 */
export function createMockContractAddresses(overrides: any = {}) {
  return {
    mainnet: {
      ...MOCK_CONTRACT_ADDRESSES.mainnet,
      ...overrides.mainnet
    },
    sepolia: {
      ...MOCK_CONTRACT_ADDRESSES.sepolia,
      ...overrides.sepolia
    },
    sunet: {
      ...MOCK_CONTRACT_ADDRESSES.sunet,
      ...overrides.sunet
    }
  };
}
