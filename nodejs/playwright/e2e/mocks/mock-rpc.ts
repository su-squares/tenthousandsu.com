import type { Page } from '@playwright/test';

export type MockRpcOptions = {
  chainId: number;
  salePriceWei?: string;
  failDuplicatePurchase?: boolean;
};

const DEFAULT_SALE_PRICE_WEI = '0x6f05b59d3b20000'; // 0.5 ETH
const SALE_PRICE_SIG = '0xf51f96dd';
const ENS_REVERSE_SIG = '0xec11c823';
const MULTICALL_AGGREGATE3_SIG = '0x82ad56cb';

export async function installMockRpc(page: Page, options: MockRpcOptions) {
  const config = {
    chainId: options.chainId,
    salePriceWei: options.salePriceWei || DEFAULT_SALE_PRICE_WEI,
    failDuplicatePurchase: options.failDuplicatePurchase !== false,
    salePriceSig: SALE_PRICE_SIG,
    ensReverseSig: ENS_REVERSE_SIG,
    multicallAggregate3Sig: MULTICALL_AGGREGATE3_SIG,
  };

  await page.addInitScript((opts) => {
    const state = {
      chainId: opts.chainId,
      salePriceWei: opts.salePriceWei,
      failDuplicatePurchase: opts.failDuplicatePurchase,
      purchasedSquares: new Set(),
      blockNumber: Math.floor(Date.now() / 1000),
    };

    const toHex = (n: number): string => '0x' + Number(n).toString(16);
    const normalizeHex = (value: unknown): string => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      try {
        return `0x${BigInt(value as string | number | bigint).toString(16)}`;
      } catch (_error) {
        return '0x0';
      }
    };
    const pad32 = (value: unknown): string => {
      const hex = normalizeHex(value).replace(/^0x/, '');
      return `0x${hex.padStart(64, '0')}`;
    };
    const encodeAggregate3Empty = () => {
      const words = [pad32('0x20'), pad32('0x0')];
      return `0x${words.map((word) => word.slice(2)).join('')}`;
    };

    const jsonResponse = (id: unknown, result: unknown) =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const jsonError = (id: unknown, message: string) =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const originalFetch = window.fetch.bind(window);

    const decodePurchaseSquareId = (data: unknown): number | null => {
      if (typeof data !== 'string') return null;
      if (!data.startsWith('0x') || data.length < 10 + 64) return null;
      const argHex = data.slice(-64);
      const value = Number.parseInt(argHex, 16);
      return Number.isFinite(value) ? value : null;
    };

    const PURCHASE_SIGS = new Set(['0xa0712d68', '0x1249c58b', '0xefef39a1']);

    const wrapEthereum = (eth: any) => {
      if (!eth || (eth as any).__e2eWrapped) return eth;
      const originalRequest = eth.request.bind(eth);
      eth.request = async (args: any) => {
        if (args?.method === 'eth_sendTransaction') {
          const tx = args?.params?.[0] || {};
          const data = tx?.data || '';
          const methodSig = typeof data === 'string' ? data.slice(0, 10) : '';
          if (state.failDuplicatePurchase && PURCHASE_SIGS.has(methodSig)) {
            const squareId = decodePurchaseSquareId(data);
            if (squareId && state.purchasedSquares.has(squareId)) {
              throw new Error('Square already minted');
            }
          }

          const result = await originalRequest(args);

          if (PURCHASE_SIGS.has(methodSig)) {
            const squareId = decodePurchaseSquareId(data);
            if (squareId) state.purchasedSquares.add(squareId);
          }

          return result;
        }

        return originalRequest(args);
      };
      (eth as any).__e2eWrapped = true;
      return eth;
    };

    try {
      let currentEth: any = null;
      if ((window as any).ethereum) {
        currentEth = wrapEthereum((window as any).ethereum);
      }

      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        get() {
          return currentEth;
        },
        set(value) {
          currentEth = wrapEthereum(value);
        },
      });
    } catch (_error) {
      if ((window as any).ethereum) wrapEthereum((window as any).ethereum);
    }

    const isLocalRpc = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
      } catch {
        return false;
      }
    };

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

      // Pass through non-RPC requests
      if (!url) {
        return originalFetch(input, init);
      }

      // Only intercept local RPC calls; let external calls pass through
      if (!isLocalRpc(url)) {
        return originalFetch(input, init);
      }

      let bodyText = null;

      if (typeof init?.body === 'string') {
        bodyText = init.body;
      } else if (input instanceof Request) {
        try {
          bodyText = await input.clone().text();
        } catch (_error) {
          bodyText = null;
        }
      }

      if (!bodyText) {
        return originalFetch(input, init);
      }

      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch (_error) {
        return originalFetch(input, init);
      }

      if (Array.isArray(payload)) {
        return originalFetch(input, init);
      }

      const { id, method, params } = payload || {};
      if (!method) return originalFetch(input, init);

      switch (method) {
        case 'eth_chainId':
          return jsonResponse(id, toHex(state.chainId));
        case 'eth_blockNumber':
          state.blockNumber += 1;
          return jsonResponse(id, toHex(state.blockNumber));
        case 'eth_getBlockByNumber':
          return jsonResponse(id, {
            number: toHex(state.blockNumber),
            hash: '0x' + '01'.repeat(32),
            timestamp: toHex(Date.now()),
            gasLimit: '0x1c9c380',
            gasUsed: '0x5208',
            miner: '0x' + '00'.repeat(20),
            transactions: [],
          });
        case 'eth_gasPrice':
          return jsonResponse(id, '0x3b9aca00');
        case 'eth_estimateGas':
          return jsonResponse(id, '0x5208');
        case 'eth_getBalance':
          return jsonResponse(id, '0x0');
        case 'eth_call': {
          const callData = params?.[0]?.data;
          const data = typeof callData === 'string' ? callData.toLowerCase() : '';
          if (data.startsWith(opts.salePriceSig)) {
            return jsonResponse(id, pad32(state.salePriceWei || '0x0'));
          }
          if (data.startsWith(opts.ensReverseSig)) {
            return jsonError(id, 'ENS not available on test network');
          }
          if (data.startsWith(opts.multicallAggregate3Sig)) {
            return jsonResponse(id, encodeAggregate3Empty());
          }
          return jsonResponse(id, '0x');
        }
        case 'eth_getTransactionReceipt': {
          const hash = params?.[0];
          if (!hash) return jsonResponse(id, null);
          return jsonResponse(id, {
            transactionHash: hash,
            transactionIndex: '0x0',
            blockHash: '0x' + '01'.repeat(32),
            blockNumber: toHex(state.blockNumber),
            from: '0x' + '00'.repeat(20),
            to: '0x' + '00'.repeat(20),
            cumulativeGasUsed: '0x5208',
            gasUsed: '0x5208',
            contractAddress: null,
            logs: [],
            logsBloom: '0x' + '00'.repeat(256),
            status: '0x1',
            effectiveGasPrice: '0x3b9aca00',
            type: '0x2',
          });
        }
        case 'eth_getTransactionByHash': {
          const hash = params?.[0];
          if (!hash) return jsonResponse(id, null);
          return jsonResponse(id, {
            hash,
            nonce: '0x1',
            blockHash: '0x' + '01'.repeat(32),
            blockNumber: toHex(state.blockNumber),
            transactionIndex: '0x0',
            from: '0x' + '00'.repeat(20),
            to: '0x' + '00'.repeat(20),
            value: '0x0',
            gas: '0x5208',
            gasPrice: '0x3b9aca00',
            input: '0x',
          });
        }
        default:
          return jsonError(id, `Mock RPC does not support ${method}`);
      }
    };

    (window as any).__E2E_MOCK_RPC__ = state;
    (window as any).__E2E_SKIP_AVAILABILITY_CHECK = true;
  }, config);
}
