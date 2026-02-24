import { vi } from 'vitest';

type ShouldEagerLoadMock = ReturnType<typeof vi.fn<[], boolean>>;
type LoadWeb3Mock = ReturnType<typeof vi.fn<[], Promise<unknown>>>;

export const foundationMocks: {
  shouldEagerLoadWeb3: ShouldEagerLoadMock;
  loadWeb3: LoadWeb3Mock;
} = {
  shouldEagerLoadWeb3: vi.fn<[], boolean>(() => false),
  loadWeb3: vi.fn<[], Promise<unknown>>()
};

export function resetFoundationMocks() {
  foundationMocks.shouldEagerLoadWeb3.mockReset();
  foundationMocks.shouldEagerLoadWeb3.mockReturnValue(false);
  foundationMocks.loadWeb3.mockReset();
}

vi.mock('@web3/foundation.js', () => ({
  shouldEagerLoadWeb3: () => foundationMocks.shouldEagerLoadWeb3(),
  loadWeb3: () => foundationMocks.loadWeb3()
}));
