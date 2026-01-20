import { vi } from 'vitest';

export function createMockSquareData(
  count = 10,
  mintedFilter: (i: number) => boolean = (i) => i % 2 === 0
) {
  return {
    personalizations: Array.from({ length: count }, (_, i) => ({
      name: `Square ${i + 1}`,
    })),
    extra: Array.from({ length: count }, (_, i) =>
      mintedFilter(i) ? { minted: true } : null
    ),
  };
}

export function createPersonalizeOptions(overrides: Record<string, unknown> = {}) {
  const trigger = document.createElement('button');
  trigger.textContent = 'Choose';
  document.body.appendChild(trigger);

  return {
    trigger,
    getSquares: vi.fn().mockResolvedValue([1, 2, 3, 4, 5]),
    getSelectedIds: vi.fn().mockReturnValue([]),
    onSelectionChange: vi.fn(),
    onConfirm: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

export function createListOptions(overrides: Record<string, unknown> = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  const trigger = document.createElement('button');
  trigger.textContent = 'Choose';
  document.body.appendChild(input);
  document.body.appendChild(trigger);

  return {
    input,
    trigger,
    filter: () => true,
    onSelect: vi.fn(),
    updateInput: true,
    ...overrides,
  };
}

export function cleanupChooserDOM() {
  // Remove any backdrop elements created by choosers
  document.querySelectorAll('.su-chooser-backdrop').forEach((el) => el.remove());
  // Remove any test elements
  document.querySelectorAll('button, input').forEach((el) => {
    if (el.parentNode === document.body) {
      el.remove();
    }
  });
}

export function dispatchKeydown(
  target: HTMLElement | Document,
  key: string,
  options: Partial<KeyboardEventInit> = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

export async function openChooserAndWait(
  chooser: { open: () => Promise<void> },
  timeout = 100
) {
  await chooser.open();
  // Small delay for DOM updates
  await new Promise((resolve) => setTimeout(resolve, timeout));
}
