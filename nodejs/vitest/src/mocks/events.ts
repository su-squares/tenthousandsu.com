export function waitForEvent(
  eventName: string,
  timeout: number = 1000
): Promise<CustomEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Event ${eventName} not fired within ${timeout}ms`));
    }, timeout);

    const handler = (event: Event) => {
      cleanup();
      resolve(event as CustomEvent);
    };

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener(eventName, handler);
    };

    window.addEventListener(eventName, handler);
  });
}

export function spyOnEvent(eventName: string) {
  const events: CustomEvent[] = [];
  const handler = (event: Event) => {
    events.push(event as CustomEvent);
  };

  window.addEventListener(eventName, handler);

  return {
    events,
    cleanup: () => window.removeEventListener(eventName, handler),
    waitFor: () => waitForEvent(eventName)
  };
}
