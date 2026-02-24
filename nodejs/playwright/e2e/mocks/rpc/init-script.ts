export function mockRpcInitScript(opts: {
  chainId: number;
  salePriceWei?: string;
  personalizePriceWei?: string;
  balanceWei?: string;
  failDuplicatePurchase?: boolean;
  salePriceSig?: string;
  personalizePriceSig?: string;
  ownerOfSig?: string;
  balanceOfSig?: string;
  tokenOfOwnerByIndexSig?: string;
  ensReverseSig?: string;
  multicallAggregate3Sig?: string;
  purchaseSigs?: string[];
  ownerAddress?: string;
  ownerOverrides?: Array<{ squareId: number; owner: string }>;
  ownedSquares?: number[];
  interceptAllRpc?: boolean;
}) {
  const state = {
    chainId: opts.chainId,
    salePriceWei: opts.salePriceWei,
    personalizePriceWei: opts.personalizePriceWei,
    balanceWei: opts.balanceWei,
    failDuplicatePurchase: opts.failDuplicatePurchase,
    purchasedSquares: new Set<number>(),
    blockNumber: Math.floor(Date.now() / 1000),
    interceptAllRpc: Boolean(opts.interceptAllRpc),
  };

  const ownerOverrides = new Map<number, string>();
  for (const override of opts.ownerOverrides || []) {
    const squareId = Number(override?.squareId);
    if (!Number.isFinite(squareId)) continue;
    if (typeof override?.owner !== 'string') continue;
    ownerOverrides.set(squareId, override.owner);
  }

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
  const encodeAggregate3Results = (results: Array<{ success: boolean; returnData: string }>) => {
    const tupleChunks: string[] = [];
    const tupleSizes: number[] = [];

    results.forEach((result) => {
      const successHex = pad32(result.success ? '0x1' : '0x0');
      const offsetHex = pad32('0x40');
      const dataHex = (result.returnData || '0x').replace(/^0x/i, '');
      const byteLen = Math.ceil(dataHex.length / 2);
      const lenHex = pad32(`0x${byteLen.toString(16)}`);
      const paddedLen = Math.ceil(byteLen / 32) * 32;
      const paddedData = dataHex.padEnd(paddedLen * 2, '0');
      const chunk = `${successHex.slice(2)}${offsetHex.slice(2)}${lenHex.slice(2)}${paddedData}`;
      tupleChunks.push(chunk);
      tupleSizes.push(chunk.length / 2);
    });

    const head = pad32('0x20');
    const length = pad32(`0x${results.length.toString(16)}`);
    const offsets: string[] = [];
    // Offsets are relative to the OFFSET WORD's position (not the length word).
    // Data region starts 32 bytes after the last offset word.
    // For n elements: offset[i] is at byte 32 + 32 + i*32 = 64 + i*32
    // Data region starts at byte 64 + n*32
    // So offset[0] should be 32*n (bytes from offset[0] to data region start)
    let cursor = 32 * results.length;
    for (const size of tupleSizes) {
      offsets.push(pad32(`0x${cursor.toString(16)}`).slice(2));
      cursor += size;
    }

    return `0x${head.slice(2)}${length.slice(2)}${offsets.join('')}${tupleChunks.join('')}`;
  };
  const normalizeAddress = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const hex = value.toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{40}$/.test(hex)) return null;
    return `0x${hex}`;
  };
  const padAddress = (value: unknown): string | null => {
    const normalized = normalizeAddress(value);
    if (!normalized) return null;
    return `0x${normalized.slice(2).padStart(64, '0')}`;
  };

  const ownerAddress = normalizeAddress(opts.ownerAddress);
  const ownedSquares = Array.from(new Set((opts.ownedSquares || []).map(Number)))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 10000)
    .sort((a, b) => a - b);

  const readAddressArg = (data: string, argIndex: number): string | null => {
    const start = 10 + argIndex * 64;
    const hex = data.slice(start, start + 64);
    if (hex.length !== 64) return null;
    return normalizeAddress(`0x${hex.slice(24)}`);
  };

  const readUintArg = (data: string, argIndex: number): number | null => {
    const start = 10 + argIndex * 64;
    const hex = data.slice(start, start + 64);
    if (hex.length !== 64) return null;
    const value = Number.parseInt(hex, 16);
    return Number.isFinite(value) ? value : null;
  };

  const makeJsonResponse = (id: unknown, result: unknown) => ({
    jsonrpc: '2.0',
    id,
    result,
  });

  const makeJsonError = (id: unknown, message: string) => ({
    jsonrpc: '2.0',
    id,
    error: { code: -32000, message },
  });

  const jsonResponse = (id: unknown, result: unknown) =>
    new Response(JSON.stringify(makeJsonResponse(id, result)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const jsonError = (id: unknown, message: string) =>
    new Response(JSON.stringify(makeJsonError(id, message)), {
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

  const PURCHASE_SIGS = new Set<string>(opts.purchaseSigs || []);

  const resolveCallData = (callData: string) => {
    const data = typeof callData === 'string' ? callData.toLowerCase() : '';
    const salePriceSig = opts.salePriceSig || '';
    const personalizePriceSig = opts.personalizePriceSig || '';
    const ownerOfSig = opts.ownerOfSig || '';
    const balanceOfSig = opts.balanceOfSig || '';
    const tokenOfOwnerByIndexSig = opts.tokenOfOwnerByIndexSig || '';
    const ensReverseSig = opts.ensReverseSig || '';
    const multicallAggregate3Sig = opts.multicallAggregate3Sig || '';
    const debugRpc = (window as any).__E2E_RPC_DEBUG__ === true;

    if (salePriceSig && data.startsWith(salePriceSig)) {
      return { success: true, returnData: pad32(state.salePriceWei || '0x0') };
    }
    if (personalizePriceSig && data.startsWith(personalizePriceSig)) {
      return { success: true, returnData: pad32(state.personalizePriceWei || '0x0') };
    }
    if (ownerOfSig && data.startsWith(ownerOfSig)) {
      const argHex = data.slice(-64);
      const squareId = Number.parseInt(argHex, 16);
      const overrideOwner = Number.isFinite(squareId) ? ownerOverrides.get(squareId) : null;
      const owner = overrideOwner ?? opts.ownerAddress ?? '0x0000000000000000000000000000000000000000';
      const padded = padAddress(owner) || pad32('0x0');
      if (debugRpc) {
        console.log('[E2E RPC] ownerOf', { squareId, owner });
      }
      return { success: true, returnData: padded };
    }
    if (balanceOfSig && data.startsWith(balanceOfSig)) {
      const addr = readAddressArg(data, 0);
      const matchesOwner = ownerAddress ? addr === ownerAddress : Boolean(addr);
      const count = matchesOwner ? ownedSquares.length : 0;
      if (debugRpc) {
        console.log('[E2E RPC] balanceOf', {
          addr,
          ownerAddress,
          matchesOwner,
          count,
        });
      }
      return { success: true, returnData: pad32(count) };
    }
    if (tokenOfOwnerByIndexSig && data.startsWith(tokenOfOwnerByIndexSig)) {
      const addr = readAddressArg(data, 0);
      const index = readUintArg(data, 1);
      const matchesOwner = ownerAddress ? addr === ownerAddress : Boolean(addr);
      const tokenId =
        matchesOwner && index !== null && index >= 0 && index < ownedSquares.length
          ? ownedSquares[index]
          : 0;
      if (debugRpc) {
        console.log('[E2E RPC] tokenOfOwnerByIndex', {
          addr,
          ownerAddress,
          index,
          matchesOwner,
          tokenId,
        });
      }
      return { success: true, returnData: pad32(tokenId) };
    }
    if (ensReverseSig && data.startsWith(ensReverseSig)) {
      return { success: false, returnData: '0x' };
    }
    if (multicallAggregate3Sig && data.startsWith(multicallAggregate3Sig)) {
      return { success: true, returnData: encodeAggregate3Empty() };
    }
    return { success: true, returnData: '0x' };
  };

  const decodeAggregate3Calls = (data: string) => {
    if (typeof data !== 'string' || !data.startsWith('0x') || data.length < 10) return [];
    const args = data.slice(10);
    const readWordAtByte = (byteOffset: number) => {
      const start = byteOffset * 2;
      return args.slice(start, start + 64).padEnd(64, '0');
    };

    const arrayOffset = Number(BigInt(`0x${readWordAtByte(0)}`));
    if (!Number.isFinite(arrayOffset) || arrayOffset < 0) return [];
    const length = Number(BigInt(`0x${readWordAtByte(arrayOffset)}`));
    if (!Number.isFinite(length) || length <= 0) return [];

    const calls: Array<{ target: string; allowFailure: boolean; callData: string }> = [];
    for (let i = 0; i < length; i += 1) {
      const offsetWord = readWordAtByte(arrayOffset + 32 + i * 32);
      const tupleOffset = Number(BigInt(`0x${offsetWord}`));
      if (!Number.isFinite(tupleOffset) || tupleOffset < 0) continue;
      // Offsets are relative to the array data *after* the length word.
      const tupleStart = arrayOffset + 32 + tupleOffset;

      const targetWord = readWordAtByte(tupleStart);
      const allowWord = readWordAtByte(tupleStart + 32);
      const dataOffsetWord = readWordAtByte(tupleStart + 64);

      const target = `0x${targetWord.slice(24)}`;
      const allowFailure = allowWord.endsWith('1');
      const dataOffset = Number(BigInt(`0x${dataOffsetWord}`));
      if (!Number.isFinite(dataOffset) || dataOffset < 0) continue;

      const callDataStart = tupleStart + dataOffset;
      const lengthWord = readWordAtByte(callDataStart);
      const callDataLength = Number(BigInt(`0x${lengthWord}`));
      if (!Number.isFinite(callDataLength) || callDataLength < 0) continue;

      const dataStart = callDataStart + 32;
      const hexLen = Math.max(0, callDataLength * 2);
      const callDataHex = args.slice(dataStart * 2, dataStart * 2 + hexLen);
      const callData = `0x${callDataHex}`;

      calls.push({ target, allowFailure, callData });
    }

    return calls;
  };

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
    if (state.interceptAllRpc) return true;
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

  const handlePayload = (entry: any) => {
    const { id, method, params } = entry || {};
    if (!method) return null;
    const debugRpc = (window as any).__E2E_RPC_DEBUG__ === true;
    if (debugRpc) {
      if (method === 'eth_call') {
        const data = params?.[0]?.data;
        const sig = typeof data === 'string' ? data.slice(0, 10) : 'unknown';
        const to = params?.[0]?.to || '';
        console.log('[E2E RPC] eth_call', { sig, to });
      } else {
        console.log('[E2E RPC]', method);
      }
    }

      switch (method) {
      case 'eth_chainId':
        return makeJsonResponse(id, toHex(state.chainId));
      case 'eth_blockNumber':
        state.blockNumber += 1;
        return makeJsonResponse(id, toHex(state.blockNumber));
      case 'eth_getBlockByNumber':
        return makeJsonResponse(id, {
          number: toHex(state.blockNumber),
          hash: '0x' + '01'.repeat(32),
          timestamp: toHex(Date.now()),
          gasLimit: '0x1c9c380',
          gasUsed: '0x5208',
          miner: '0x' + '00'.repeat(20),
          transactions: [],
        });
      case 'eth_gasPrice':
        return makeJsonResponse(id, '0x3b9aca00');
      case 'eth_maxPriorityFeePerGas':
        return makeJsonResponse(id, '0x3b9aca00');
      case 'eth_feeHistory':
        return makeJsonResponse(id, {
          oldestBlock: toHex(state.blockNumber),
          baseFeePerGas: ['0x1'],
          gasUsedRatio: [0],
          reward: [['0x0']],
        });
      case 'eth_getTransactionCount':
        return makeJsonResponse(id, '0x1');
      case 'eth_getCode':
        return makeJsonResponse(id, '0x');
      case 'eth_estimateGas':
        return makeJsonResponse(id, '0x5208');
      case 'eth_getBalance':
        return makeJsonResponse(id, state.balanceWei || '0x0');
      case 'eth_call': {
        const callData = params?.[0]?.data;
        const data = typeof callData === 'string' ? callData.toLowerCase() : '';
        const multicallAggregate3Sig = opts.multicallAggregate3Sig || '';

        if (multicallAggregate3Sig && data.startsWith(multicallAggregate3Sig)) {
          const calls = decodeAggregate3Calls(data);
          if ((window as any).__E2E_RPC_DEBUG__ === true) {
            const sigs = calls.slice(0, 5).map((call) => call.callData?.slice(0, 10));
            const first = calls[0];
            console.log('[E2E RPC] multicall decoded', {
              count: calls.length,
              sigs: sigs.join(','),
              firstTarget: first?.target,
              firstCallDataSig: first?.callData?.slice(0, 10),
              firstCallDataLen: first?.callData ? first.callData.length : 0,
            });
          }
          if (!calls.length) {
            return makeJsonResponse(id, encodeAggregate3Empty());
          }
          const results = calls.map((call) => resolveCallData(call.callData));
          const encoded = encodeAggregate3Results(results);
          if ((window as any).__E2E_RPC_DEBUG__ === true) {
            const firstSig = calls[0]?.callData?.slice(0, 10);
            // For ownership calls, log full encoded response to verify encoding
            if (firstSig === '0x6352211e' || firstSig === '0x70a08231' || firstSig === '0x2f745c59') {
              console.log('[E2E RPC] ownership multicall FULL', {
                sig: firstSig,
                results: results.map((r) => ({ success: r.success, returnData: r.returnData })),
                encoded: encoded,
              });
            } else {
              console.log('[E2E RPC] multicall response', {
                resultCount: results.length,
                encodedLen: encoded.length,
              });
            }
          }
          return makeJsonResponse(id, encoded);
        }

        const resolved = resolveCallData(data);
        return makeJsonResponse(id, resolved.returnData);
      }
      case 'eth_getTransactionReceipt': {
        const hash = params?.[0];
        if (!hash) return makeJsonResponse(id, null);
        return makeJsonResponse(id, {
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
        if (!hash) return makeJsonResponse(id, null);
        return makeJsonResponse(id, {
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
        return makeJsonError(id, `Mock RPC does not support ${method}`);
      }
    };

    if (Array.isArray(payload)) {
      const results = payload.map((entry) => {
        const response = handlePayload(entry);
        if (!response) {
          return { jsonrpc: '2.0', id: entry?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
        }
        return response;
      });

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = handlePayload(payload);
    if (response) {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return originalFetch(input, init);
  };

  (window as any).__E2E_MOCK_RPC__ = {
    ...state,
    ownedSquares: [...ownedSquares],
    ownerAddress: ownerAddress ?? opts.ownerAddress ?? null,
  };
  (window as any).__E2E_SKIP_AVAILABILITY_CHECK = true;
}
