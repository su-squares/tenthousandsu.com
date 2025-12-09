function formatEnvHint(envName?: string): string {
  return envName ? ` in ${envName}` : "";
}

function ensurePositiveInteger(value: number, part: string, envName?: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid token id ${part}${formatEnvHint(envName)}. Use a positive integer or a range (start-end).`,
    );
  }
}

export function expandTokenRange(input: string, envName?: string): number[] {
  const cleaned = input.trim();
  if (!cleaned) {
    return [];
  }

  const ids: number[] = [];
  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      ensurePositiveInteger(start, part, envName);
      ensurePositiveInteger(end, part, envName);
      if (end < start) {
        throw new Error(`Invalid range ${part}${formatEnvHint(envName)}: end must be >= start.`);
      }
      for (let i = start; i <= end; i++) {
        ids.push(i);
      }
    } else {
      const value = Number(part);
      ensurePositiveInteger(value, part, envName);
      ids.push(value);
    }
  }

  return ids;
}

export function summarizeTokenIds(ids: number[]): string {
  if (ids.length === 0) {
    return "none";
  }
  if (ids.length <= 10) {
    return ids.join(", ");
  }
  return `${ids.slice(0, 5).join(", ")} ... ${ids.slice(-3).join(", ")} (${ids.length} total)`;
}
