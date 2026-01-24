// dapp/e2e/playwright/wallet/injected/provider.ts
(() => {
  // Read config injected by Node before this script executes
  const cfg = (window as any).__TEST_WALLET_CONFIG || {};
  const realMode = !!cfg.real && !!cfg.rpcUrl;

  type Listener = (...args: any[]) => void;
  const toHex = (n: number) => '0x' + Number(n).toString(16);

  // Track NFT state (MOCK only)
  let nftTokenId = 0;
  let userHasNFT = false;

  // Tx hash generator (MOCK)
  let txCounter = 1;
  const generateTxHash = () => {
    const timestamp = Date.now().toString(16);
    const counter = txCounter.toString(16).padStart(4, '0');
    const randomPart = Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const hash = '0x' + timestamp + counter + randomPart;
    const finalHash = hash.substring(0, 66).padEnd(66, '0');
    txCounter++;
    return finalHash;
  };

  // Connection persistence
  const CONNECTED_MARKER_KEY = 'testwallet.connected';
  const wasConnectedBefore = (): boolean => {
    try {
      return localStorage.getItem(CONNECTED_MARKER_KEY) === 'true';
    } catch {
      return false;
    }
  };
  const setConnectedMarker = (v: boolean) => {
    try {
      if (v) localStorage.setItem(CONNECTED_MARKER_KEY, 'true');
      else localStorage.removeItem(CONNECTED_MARKER_KEY);
    } catch {}
  };

  // Bridge for REAL mode
  const bridge = {
    async rpc(method: string, params: any[] = []) {
      // @ts-ignore
      return await (window as any).__testwallet_rpc(method, params);
    },
    async sendTransaction(tx: any) {
      // @ts-ignore
      return await (window as any).__testwallet_sendTransaction(tx);
    },
    async signMessage(message: string, isHex: boolean) {
      // @ts-ignore
      return await (window as any).__testwallet_signMessage({ message, isHex });
    },
    async signTypedData(payload: any) {
      // @ts-ignore
      return await (window as any).__testwallet_signTypedData(payload);
    },
  };

  // EIP-1193 provider
  const mockProvider: any = {
    isMetaMask: false,
    isTestWallet: true,

    _connected: false,
    _accounts: [] as string[],
    _chainId: cfg.chainId as number,
    _listeners: {} as Record<string, Listener[]>,
    _persistConnection: !!cfg.persistConnection,
    _txDelay: cfg.txDelay ?? 2000,
    _pendingTxs: new Map<string, any>(),
    _blockNumber: Math.floor(Date.now() / 1000),

    async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
      switch (method) {
        case 'eth_requestAccounts':
        case 'wallet_requestPermissions': {
          if (!this._connected) {
            await new Promise((r) => setTimeout(r, 100));
            this._connected = true;
            this._accounts = [cfg.address as string];
            this.emit('accountsChanged', this._accounts);
            setConnectedMarker(true);
          }
          return method === 'eth_requestAccounts' ? this._accounts : [{ eth_accounts: {} }];
        }

        case 'eth_accounts': {
          if (this._persistConnection && !this._connected && wasConnectedBefore()) {
            this._connected = true;
            this._accounts = [cfg.address as string];
          }
          return this._accounts;
        }

        case 'eth_chainId':
          return toHex(this._chainId);

        case 'wallet_switchEthereumChain': {
          const target = params?.[0]?.chainId;
          if (typeof target === 'string') {
            const newId = parseInt(target, 16);
            if (!Number.isNaN(newId) && newId !== this._chainId) {
              this._chainId = newId;
              this.emit('chainChanged', toHex(this._chainId));
            }
          }
          return null;
        }

        case 'wallet_addEthereumChain':
          return null;

        case 'wallet_revokePermissions': {
          this._connected = false;
          this._accounts = [];
          this.emit('accountsChanged', []);
          setConnectedMarker(false);
          return null;
        }

        case 'wallet_getPermissions':
          return this._connected ? [{ eth_accounts: {} }] : [];

        // ---- SIGNING ----
        case 'personal_sign': {
          const [message] = params || [];
          if (!realMode) {
            await new Promise(r => setTimeout(r, 300));
            return '0x' + '00'.repeat(65);
          }
          const isHexMessage = typeof message === 'string' && message.startsWith('0x');
          return await bridge.signMessage(message, isHexMessage);
        }

        case 'eth_sign':
        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          const [, typedRaw] = params || [];
          if (!realMode) {
            await new Promise(r => setTimeout(r, 300));
            return '0x' + '00'.repeat(65);
          }
          const parsed = typeof typedRaw === 'string' ? JSON.parse(typedRaw) : typedRaw;
          return await bridge.signTypedData(parsed);
        }

        // ---- SEND TX ----
        case 'eth_sendTransaction': {
          const txData = params?.[0] || {};
          if (realMode) {
            const txHash = await bridge.sendTransaction(txData);
            return txHash;
          }

          const txHash = generateTxHash();
          const methodSig = txData?.data?.substring(0, 10);
          const isMint = methodSig === '0x1249c58b' || methodSig === '0xa0712d68' || txData?.data?.includes('mint');
          const isBurn = methodSig === '0x42966c68' || txData?.data?.includes('burn');

          this._pendingTxs.set(txHash, {
            from: txData?.from || cfg.address,
            to: txData?.to,
            data: txData?.data,
            value: txData?.value || '0x0',
            gas: txData?.gas || '0x5208',
            gasPrice: txData?.gasPrice || '0x3b9aca00',
            status: 'pending',
            isMint,
            isBurn,
            blockNumber: null,
          });

          await new Promise((r) => setTimeout(r, 500));
          const txInfo = this._pendingTxs.get(txHash);
          if (txInfo) txInfo.status = 'sent';

          setTimeout(() => {
            this._blockNumber++;
            const t = this._pendingTxs.get(txHash);
            if (t) {
              t.status = 'mined';
              t.blockNumber = toHex(this._blockNumber);
              if (isMint && !userHasNFT) {
                nftTokenId++;
                userHasNFT = true;
              } else if (isBurn && userHasNFT) {
                userHasNFT = false;
              }
            }
          }, this._txDelay);

          return txHash;
        }

        // ---- RECEIPTS/QUERIES ----
        case 'eth_getTransactionReceipt': {
          const hash = params?.[0];
          if (realMode) {
            return await bridge.rpc('eth_getTransactionReceipt', [hash]);
          }

          const txInfo = this._pendingTxs.get(hash);
          if (!txInfo || txInfo.status !== 'mined') return null;

          const logs: any[] = [];
          if (txInfo.isMint) {
            logs.push({
              address: txInfo.to.toLowerCase(),
              topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                '0x0000000000000000000000000000000000000000000000000000000000000000',
                '0x000000000000000000000000' + (cfg.address as string).substring(2).toLowerCase(),
              ],
              data: '0x' + nftTokenId.toString(16).padStart(64, '0'),
              blockNumber: txInfo.blockNumber,
              transactionHash: hash,
              transactionIndex: '0x0',
              blockHash: '0x' + Math.random().toString(16).substring(2).padEnd(64, '0'),
              logIndex: '0x0',
              removed: false,
            });
          } else if (txInfo.isBurn) {
            logs.push({
              address: txInfo.to.toLowerCase(),
              topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                '0x000000000000000000000000' + (cfg.address as string).substring(2).toLowerCase(),
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              ],
              data: '0x' + nftTokenId.toString(16).padStart(64, '0'),
              blockNumber: txInfo.blockNumber,
              transactionHash: hash,
              transactionIndex: '0x0',
              blockHash: '0x' + Math.random().toString(16).substring(2).padEnd(64, '0'),
              logIndex: '0x0',
              removed: false,
            });
          }

          return {
            transactionHash: hash,
            transactionIndex: '0x0',
            blockHash: '0x' + Math.random().toString(16).substring(2).padEnd(64, '0'),
            blockNumber: txInfo.blockNumber,
            from: txInfo.from.toLowerCase(),
            to: txInfo.to.toLowerCase(),
            cumulativeGasUsed: '0x5208',
            gasUsed: '0x5208',
            contractAddress: null,
            logs,
            logsBloom: '0x' + '00'.repeat(256),
            status: '0x1',
            effectiveGasPrice: txInfo.gasPrice,
            type: '0x2',
          };
        }

        case 'eth_getTransactionByHash': {
          const hash = params?.[0];
          if (realMode) return await bridge.rpc('eth_getTransactionByHash', [hash]);
          const txInfo = this._pendingTxs.get(hash);
          if (!txInfo) return null;
          return {
            hash,
            nonce: '0x1',
            blockHash: txInfo.status === 'mined' ? '0x' + '01'.repeat(32) : null,
            blockNumber: txInfo.status === 'mined' ? txInfo.blockNumber : null,
            transactionIndex: txInfo.status === 'mined' ? '0x0' : null,
            from: txInfo.from,
            to: txInfo.to,
            value: txInfo.value,
            gas: txInfo.gas,
            gasPrice: txInfo.gasPrice,
            input: txInfo.data || '0x',
          };
        }

        case 'eth_blockNumber':
          return realMode ? await bridge.rpc('eth_blockNumber') : toHex(this._blockNumber);

        case 'eth_call': {
          const callData = params?.[0];
          if (realMode) return await bridge.rpc('eth_call', params || []);
          const methodSig = callData?.data?.substring(0, 10);
          if (methodSig === '0x70a08231') return userHasNFT ? '0x1' : '0x0'; // balanceOf
          if (methodSig === '0x6352211e') return '0x' + (cfg.address as string).substring(2).padStart(64, '0'); // ownerOf
          if (methodSig === '0x18160ddd') return ('0x' + nftTokenId.toString(16)).padStart(66, '0'); // totalSupply
          return '0x' + '00'.repeat(32);
        }

        case 'eth_estimateGas':
          return realMode ? await bridge.rpc('eth_estimateGas', params || []) : '0x5208';

        case 'eth_gasPrice':
          return realMode ? await bridge.rpc('eth_gasPrice') : '0x3b9aca00';

        case 'eth_getBlockByNumber':
          if (realMode) return await bridge.rpc('eth_getBlockByNumber', params || []);
          return {
            number: toHex(this._blockNumber),
            hash: '0x' + '01'.repeat(32),
            timestamp: toHex(Date.now()),
            gasLimit: '0x1c9c380',
            gasUsed: '0x5208',
            miner: '0x' + '00'.repeat(20),
            transactions: [],
          };

        default:
          if (realMode) return await bridge.rpc(method, params || []);
          throw new Error(`Method ${method} not supported`);
      }
    },

    on(event: string, listener: Listener) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(listener);
      return this;
    },
    once(event: string, listener: Listener) {
      const wrap: Listener = (...args: any[]) => { listener(...args); this.removeListener(event, wrap); };
      return this.on(event, wrap);
    },
    removeListener(event: string, listener: Listener) {
      if (!this._listeners[event]) return this;
      this._listeners[event] = this._listeners[event].filter((fn: Listener) => fn !== listener);
      return this;
    },
    emit(event: string, ...args: any[]) {
      if (!this._listeners[event]) return false;
      this._listeners[event].forEach((fn: Listener) => fn(...args));
      return true;
    },
    disconnect() {
      this._connected = false;
      this._accounts = [];
      this.emit('accountsChanged', []);
      this.emit('disconnect');
      setConnectedMarker(false);
    },
  };

  (window as any).ethereum = mockProvider;

  // EIP-6963 announce
  const info = {
    uuid: cfg.uuid,
    name: cfg.walletName,
    icon: cfg.walletIcon,
    rdns: cfg.rdns,
  };
  const announceProvider = () => {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider: mockProvider } }));
  };
  announceProvider();
  window.addEventListener('eip6963:requestProvider', announceProvider);
})();
