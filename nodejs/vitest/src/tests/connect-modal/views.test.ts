import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestContainer, cleanupTestContainer } from '@test-helpers/dom';
import { renderListView } from '@web3/wallet/connect-modal/views/list.js';
import { renderQrView } from '@web3/wallet/connect-modal/views/qr.js';
import { renderErrorView } from '@web3/wallet/connect-modal/views/error.js';
import { renderConnectingView } from '@web3/wallet/connect-modal/views/connecting.js';
import { renderCanceledView } from '@web3/wallet/connect-modal/views/canceled.js';
import { CONNECTING_VARIANT } from '@web3/wallet/connect-modal/constants.js';
import { renderQr } from '@web3/wallet/qr.js';

vi.mock('@web3/wallet/qr.js', () => ({ renderQr: vi.fn() }));

describe('connect-modal/views', () => {
  const renderQrMock = vi.mocked(renderQr);

  const flushMicrotasks = async (count = 2) => {
    for (let i = 0; i < count; i += 1) {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true
    });
    renderQrMock.mockReset();
  });

  it('renders list view and handles selection and info link', () => {
    const container = createTestContainer();
    const connectors = [
      { id: 'injected', name: 'Injected' },
      { id: 'walletConnect', name: 'WalletConnect' },
      { id: 'eip', _eip6963: { uuid: 'uuid-1', name: 'Rainbow', icon: 'data:image/svg+xml;base64,abc' } }
    ];
    const onSelect = vi.fn();
    const onOpenInfo = vi.fn();

    renderListView(container, { connectors, onSelect, onOpenInfo });

    const buttons = container.querySelectorAll('[data-connector-uid]');
    expect(buttons.length).toBe(3);

    const eipButton = container.querySelector('[data-connector-uid="uuid-1"]') as HTMLButtonElement;
    eipButton.click();
    expect(onSelect).toHaveBeenCalledWith(connectors[2]);

    const infoButton = container.querySelector('[data-info-modal]') as HTMLButtonElement;
    infoButton.click();
    expect(onOpenInfo).toHaveBeenCalledTimes(1);

    const firstButton = buttons[0] as HTMLButtonElement;
    const secondButton = buttons[1] as HTMLButtonElement;
    firstButton.focus();
    firstButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(secondButton);

    cleanupTestContainer(container);
  });

  it('renders empty list view copy when no connectors', () => {
    const container = createTestContainer();

    renderListView(container, { connectors: [], onSelect: vi.fn(), onOpenInfo: vi.fn() });

    expect(container.textContent).toContain('No wallets found');
    cleanupTestContainer(container);
  });

  it('renders QR view and wires actions', async () => {
    const container = createTestContainer();
    const onCopy = vi.fn();
    const onOpenWallet = vi.fn();

    renderQrMock.mockResolvedValueOnce(undefined);

    renderQrView(container, { qrUri: 'wc:test', copied: false }, { onCopy, onOpenWallet });

    const copyButton = container.querySelector('[data-copy]') as HTMLButtonElement;
    const openButton = container.querySelector('[data-open-wallet]') as HTMLButtonElement;
    copyButton.click();
    openButton.click();

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onOpenWallet).toHaveBeenCalledTimes(1);

    await flushMicrotasks();

    const placeholder = container.querySelector('#wallet-qr-placeholder') as HTMLElement;
    const canvas = container.querySelector('#wallet-qr-canvas') as HTMLCanvasElement;
    const logo = container.querySelector('.wallet-qr__logo') as HTMLElement;

    expect(placeholder.style.display).toBe('none');
    expect(canvas.style.display).toBe('block');
    expect(canvas.classList.contains('wallet-fade')).toBe(true);
    expect(logo.classList.contains('wallet-qr__logo--visible')).toBe(true);

    cleanupTestContainer(container);
  });

  it('shows QR error message when rendering fails', async () => {
    const container = createTestContainer();
    renderQrMock.mockRejectedValueOnce(new Error('fail'));

    renderQrView(container, { qrUri: 'wc:test', copied: false }, { onCopy: vi.fn(), onOpenWallet: vi.fn() });

    await flushMicrotasks();

    const placeholder = container.querySelector('#wallet-qr-placeholder') as HTMLElement;
    expect(placeholder.innerHTML).toContain('QR generation failed');

    cleanupTestContainer(container);
  });

  it('renders connecting view actions by variant', () => {
    const container = createTestContainer();
    const onCancel = vi.fn();
    const onOpenWallet = vi.fn();
    const onShowQr = vi.fn();

    renderConnectingView(container, {
      variant: CONNECTING_VARIANT.WALLETCONNECT,
      hasUri: true,
      onCancel,
      onOpenWallet,
      onShowQr
    });

    const cancelButton = container.querySelector('[data-cancel]') as HTMLButtonElement;
    const openButton = container.querySelector('[data-open-wallet]') as HTMLButtonElement;
    const showQrButton = container.querySelector('[data-show-qr]') as HTMLButtonElement;

    cancelButton.click();
    openButton.click();
    showQrButton.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenWallet).toHaveBeenCalledTimes(1);
    expect(onShowQr).toHaveBeenCalledTimes(1);

    cleanupTestContainer(container);
  });

  it('renders error and canceled views with back actions', () => {
    const container = createTestContainer();
    const onBack = vi.fn();

    renderErrorView(container, { message: '', onBack });
    expect(container.textContent).toContain('Something went wrong.');
    (container.querySelector('[data-back]') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalledTimes(1);

    renderCanceledView(container, onBack);
    expect(container.textContent).toContain('Request canceled');
    (container.querySelector('[data-back]') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalledTimes(2);

    cleanupTestContainer(container);
  });
});
