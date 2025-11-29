// Shared loader for square JSON data with simple in-memory memoization
let dataPromise;

/**
 * Load square personalization and extra metadata.
 * Returns a promise resolving to { personalizations, extra }.
 */
export function loadSquareData() {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetch("/build/squarePersonalizations.json").then((r) => {
        if (!r.ok) throw new Error("Failed to load squarePersonalizations.json");
        return r.json();
      }),
      fetch("/build/squareExtra.json").then((r) => {
        if (!r.ok) throw new Error("Failed to load squareExtra.json");
        return r.json();
      }),
    ]).then(([personalizations, extra]) => ({ personalizations, extra }));
  }
  return dataPromise;
}
