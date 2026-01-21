/**
 * Modular refresh button for balance display.
 * Returns HTML and provides handler attachment utility.
 * @module balance-refresh-button
 */

/**
 * Get the HTML for a refresh button.
 * @param {{ loading?: boolean, ariaLabel?: string }} options
 * @returns {string}
 */
export function getRefreshButtonHTML(options = {}) {
    const { loading = false, ariaLabel = "Refresh balance" } = options;
    const spinClass = loading ? " balance-refresh--spinning" : "";

    return `
    <button
      type="button"
      class="balance-refresh${spinClass}"
      aria-label="${ariaLabel}"
      data-balance-refresh
      ${loading ? "disabled" : ""}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="balance-refresh__icon"
      >
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    </button>
  `.trim();
}

/**
 * Get CSS styles for the refresh button.
 * Can be injected once into the document.
 * @returns {string}
 */
export function getRefreshButtonStyles() {
    return `
    .balance-refresh {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      background: transparent;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      color: var(--color-text-muted, #888);
      transition: color 0.2s, transform 0.2s;
    }

    .balance-refresh:hover {
      color: var(--color-accent, #646cff);
    }

    .balance-refresh:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .balance-refresh__icon {
      width: 16px;
      height: 16px;
    }

    .balance-refresh--spinning .balance-refresh__icon {
      animation: balance-refresh-spin 1s linear infinite;
    }

    @keyframes balance-refresh-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .balance-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .balance-display__value {
      font-variant-numeric: tabular-nums;
    }

    .balance-display__loading {
      color: var(--color-text-muted, #888);
      font-style: italic;
    }
  `.trim();
}

/**
 * Inject refresh button styles into the document head if not already present.
 */
export function ensureRefreshButtonStyles() {
    const STYLE_ID = "balance-refresh-styles";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = getRefreshButtonStyles();
    document.head.appendChild(style);
}

/**
 * Attach click handler to refresh button(s) within a container.
 * @param {HTMLElement} container
 * @param {() => Promise<void>} onClick
 * @returns {() => void} Cleanup function
 */
export function attachRefreshHandler(container, onClick) {
    if (!container) return () => { };

    const handler = async (event) => {
        const btn = event.target.closest("[data-balance-refresh]");
        if (!btn) return;

        event.preventDefault();

        // Add spinning state
        btn.classList.add("balance-refresh--spinning");
        btn.disabled = true;

        try {
            await onClick();
        } finally {
            // Remove spinning state
            btn.classList.remove("balance-refresh--spinning");
            btn.disabled = false;
        }
    };

    container.addEventListener("click", handler);

    return () => {
        container.removeEventListener("click", handler);
    };
}

/**
 * Render a complete balance display with refresh button.
 * @param {{ balance: any|null, loading?: boolean, symbol?: string }} options
 * @returns {string}
 */
export function renderBalanceDisplay(options = {}) {
    const { balance, loading = false, symbol = "ETH" } = options;

    if (loading && !balance) {
        return `
      <div class="balance-display">
        <span class="balance-display__loading">Loading balance...</span>
      </div>
    `.trim();
    }

    const formatted = balance?.formatted ?? "-";
    const displaySymbol = balance?.symbol ?? symbol;

    return `
    <div class="balance-display">
      <span class="balance-display__value">${formatted} ${displaySymbol}</span>
      ${getRefreshButtonHTML({ loading })}
    </div>
  `.trim();
}
