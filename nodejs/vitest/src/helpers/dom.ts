export function createTestContainer(id: string = 'test-container'): HTMLElement {
  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  return container;
}

export function cleanupTestContainer(container: HTMLElement) {
  container.remove();
}

export function queryBySelector<T extends HTMLElement = HTMLElement>(
  container: HTMLElement,
  selector: string
): T | null {
  return container.querySelector<T>(selector);
}

export async function waitForElement(
  container: HTMLElement,
  selector: string,
  timeout: number = 1000
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error(`Element ${selector} not found within ${timeout}ms`);
}
