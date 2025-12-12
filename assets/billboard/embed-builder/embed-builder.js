/**
 * Embed Builder Logic
 *
 * Configuration UI for generating embed URLs and iframe snippets.
 * Updates live preview as settings change.
 */

import {
  DEFAULT_CONFIG,
  HEADER_OPTIONS,
  buildEmbedUrlFromState,
  validateSquareRange,
  validateColor,
  validateDomains,
  checkUrlLength,
} from "./embed-config.js";

/**
 * Initialize the embed builder
 * @param {Object} options
 * @param {string} options.embedPageUrl - Base URL for the embed page
 */
export function initEmbedBuilder(options = {}) {
  const { embedPageUrl } = options;

  if (!embedPageUrl) {
    console.error("[EmbedBuilder] Missing embedPageUrl");
    return null;
  }

  // State
  const state = { ...DEFAULT_CONFIG };
  const validation = {
    blockSquares: { valid: true, error: null },
    silenceSquares: { valid: true, error: null },
    bgColor: { valid: true, error: null },
    domains: { valid: true, invalid: [] },
  };

  // DOM references
  const elements = {
    // Tabs
    tabs: document.querySelectorAll(".embed-builder__tab"),
    panels: document.querySelectorAll(".embed-builder__panel"),

    // Layout tab
    panzoomToggle: document.getElementById("panzoom-toggle"),
    hintColorPicker: document.getElementById("hint-color-picker"),
    hintColorValue: document.getElementById("hint-color-value"),
    resetColorPicker: document.getElementById("reset-color-picker"),
    resetColorValue: document.getElementById("reset-color-value"),
    mobileColorsSection: document.getElementById("mobile-color-section"),

    // Theme tab
    gradientToggle: document.getElementById("gradient-toggle"),
    bgColorPicker: document.getElementById("bg-color-picker"),
    bgColorValue: document.getElementById("bg-color-value"),
    bgTransparent: document.getElementById("bg-transparent"),

    // Header tab
    headerRadios: document.querySelectorAll('input[name="header"]'),
    headerSizeValue: document.getElementById("header-size-value"),
    headerSizeUnit: document.getElementById("header-size-unit"),
    headerColorPicker: document.getElementById("header-color-picker"),
    headerColorValue: document.getElementById("header-color-value"),

    // Blocklist tab
    blockSquaresInput: document.getElementById("block-squares"),
    blockSquaresError: document.getElementById("block-squares-error"),
    silenceSquaresInput: document.getElementById("silence-squares"),
    silenceSquaresError: document.getElementById("silence-squares-error"),
    blockDomainsInput: document.getElementById("block-domains"),
    blockDomainsError: document.getElementById("block-domains-error"),

    // Output
    urlOutput: document.getElementById("embed-url-output"),
    urlCopyBtn: document.getElementById("copy-url-btn"),
    urlWarning: document.getElementById("url-warning"),
    iframeOutput: document.getElementById("embed-iframe-output"),
    iframeCopyBtn: document.getElementById("copy-iframe-btn"),

    // Preview
    previewFrame: document.getElementById("embed-preview"),

    // Reset
    resetBtn: document.getElementById("reset-btn"),
  };

  // Debounce timer for preview updates
  let updateTimer = null;

  /**
   * Switch to a tab
   */
  function switchTab(tabId) {
    elements.tabs.forEach((tab) => {
      const isSelected = tab.dataset.tab === tabId;
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    elements.panels.forEach((panel) => {
      const isActive = panel.dataset.panel === tabId;
      panel.dataset.active = isActive ? "true" : "false";
    });
  }

  /**
   * Update state and refresh outputs
   */
  function updateState(key, value) {
    state[key] = value;
    scheduleUpdate();
  }

  /**
   * Schedule debounced update
   */
  function scheduleUpdate() {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateOutputs();
      updatePreview();
    }, 300);
  }

  function updateBackgroundControlState() {
    if (elements.bgColorPicker) {
      elements.bgColorPicker.disabled = false;
    }
    if (elements.bgColorValue) {
      elements.bgColorValue.disabled = false;
    }
    if (elements.bgTransparent) {
      elements.bgTransparent.disabled = false;
    }
  }

  function updateMobileColorSection() {
    if (!elements.mobileColorsSection) return;
    const visible = Boolean(elements.panzoomToggle?.checked);
    elements.mobileColorsSection.style.display = visible ? "" : "none";
  }

  /**
   * Generate current embed URL
   */
  function getEmbedUrl() {
    return buildEmbedUrlFromState(state, embedPageUrl);
  }

  /**
   * Update URL and iframe outputs
   */
  function updateOutputs() {
    const url = getEmbedUrl();

    // Update URL output
    if (elements.urlOutput) {
      elements.urlOutput.value = url;
    }

    // Check URL length
    const lengthCheck = checkUrlLength(url);
    if (elements.urlWarning) {
      if (lengthCheck.warning) {
        elements.urlWarning.textContent = lengthCheck.warning;
        elements.urlWarning.style.display = "block";
      } else {
        elements.urlWarning.style.display = "none";
      }
    }

    // Update iframe output - src last so users can edit props without scrolling past long URLs
    if (elements.iframeOutput) {
      const iframe = `<iframe width="600" height="600" frameborder="0" title="Su Squares Billboard" src="${escapeHtml(url)}"></iframe>`;
      elements.iframeOutput.value = iframe;
    }
  }

  /**
   * Update preview iframe
   */
  function updatePreview() {
    if (!elements.previewFrame) return;

    const url = getEmbedUrl();
    elements.previewFrame.src = url;
  }

  /**
   * Copy text to clipboard
   */
  async function copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      // Visual feedback
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.dataset.copied = "true";

        setTimeout(() => {
          button.textContent = originalText;
          button.dataset.copied = "false";
        }, 2000);
      }
    } catch (err) {
      console.error("[EmbedBuilder] Copy failed:", err);
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      if (button) {
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = button === elements.urlCopyBtn ? "Copy URL" : "Copy Iframe";
        }, 2000);
      }
    }
  }

  /**
   * Escape HTML for safe embedding
   */
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Reset to defaults
   */
  function resetToDefaults() {
    // Reset state
    Object.assign(state, DEFAULT_CONFIG);

    // Reset form controls
    if (elements.panzoomToggle) {
      elements.panzoomToggle.checked = true;
    }

    if (elements.bgTransparent) {
      elements.bgTransparent.checked = false;
    }

    if (elements.gradientToggle) {
      elements.gradientToggle.checked = true;
    }

    if (elements.bgColorPicker) {
      elements.bgColorPicker.value = "#000000";
    }

    if (elements.bgColorValue) {
      elements.bgColorValue.value = "#000000";
    }

    elements.headerRadios.forEach((radio) => {
      radio.checked = radio.value === "susquares";
    });

    if (elements.headerSizeValue) {
      elements.headerSizeValue.value = DEFAULT_CONFIG.headerSizeValue;
    }

    if (elements.headerSizeUnit) {
      elements.headerSizeUnit.value = DEFAULT_CONFIG.headerSizeUnit;
    }

    if (elements.headerColorPicker) {
      elements.headerColorPicker.value = DEFAULT_CONFIG.headerColor;
    }

    if (elements.headerColorValue) {
      elements.headerColorValue.value = DEFAULT_CONFIG.headerColor;
    }

    if (elements.hintColorPicker) {
      elements.hintColorPicker.value = DEFAULT_CONFIG.hintColor;
    }

    if (elements.hintColorValue) {
      elements.hintColorValue.value = DEFAULT_CONFIG.hintColor;
    }

    if (elements.resetColorPicker) {
      elements.resetColorPicker.value = DEFAULT_CONFIG.resetButtonColor;
    }

    if (elements.resetColorValue) {
      elements.resetColorValue.value = DEFAULT_CONFIG.resetButtonColor;
    }

    if (elements.blockSquaresInput) {
      elements.blockSquaresInput.value = "";
    }

    if (elements.silenceSquaresInput) {
      elements.silenceSquaresInput.value = "";
    }

    if (elements.blockDomainsInput) {
      elements.blockDomainsInput.value = "";
    }

    // Clear validation errors
    clearValidationErrors();

    // Update outputs
    updateOutputs();
    updatePreview();
    updateBackgroundControlState();
    updateMobileColorSection();
  }

  /**
   * Clear validation error displays
   */
  function clearValidationErrors() {
    if (elements.blockSquaresError) {
      elements.blockSquaresError.textContent = "";
      elements.blockSquaresError.style.display = "none";
    }
    if (elements.silenceSquaresError) {
      elements.silenceSquaresError.textContent = "";
      elements.silenceSquaresError.style.display = "none";
    }
    if (elements.blockDomainsError) {
      elements.blockDomainsError.textContent = "";
      elements.blockDomainsError.style.display = "none";
    }
    if (elements.blockSquaresInput) {
      elements.blockSquaresInput.removeAttribute("aria-invalid");
    }
    if (elements.silenceSquaresInput) {
      elements.silenceSquaresInput.removeAttribute("aria-invalid");
    }
    if (elements.blockDomainsInput) {
      elements.blockDomainsInput.removeAttribute("aria-invalid");
    }
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // Tab switching
    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Pan/zoom toggle
    if (elements.panzoomToggle) {
      elements.panzoomToggle.addEventListener("change", (e) => {
        updateState("panzoom", e.target.checked);
        updateMobileColorSection();
      });
    }

    if (elements.panzoomToggle) {
      elements.panzoomToggle.checked = Boolean(state.panzoom);
    }

    if (elements.gradientToggle) {
      elements.gradientToggle.checked = Boolean(state.useGradientBackground);
    }

    if (elements.hintColorPicker) {
      elements.hintColorPicker.addEventListener("input", (e) => {
        const color = e.target.value;
        if (elements.hintColorValue) {
          elements.hintColorValue.value = color;
        }
        updateState("hintColor", color);
      });
    }

    if (elements.resetColorPicker) {
      elements.resetColorPicker.addEventListener("input", (e) => {
        const color = e.target.value;
        if (elements.resetColorValue) {
          elements.resetColorValue.value = color;
        }
        updateState("resetButtonColor", color);
      });
    }

    if (elements.gradientToggle) {
      elements.gradientToggle.addEventListener("change", (e) => {
        const useGradient = e.target.checked;
        updateState("useGradientBackground", useGradient);
        if (useGradient && elements.bgTransparent && elements.bgTransparent.checked) {
          elements.bgTransparent.checked = false;
        }
        updateBackgroundControlState();
      });
    }

    // Background color
    if (elements.bgColorPicker) {
      elements.bgColorPicker.addEventListener("input", (e) => {
        const color = e.target.value;
        if (elements.bgColorValue) {
          elements.bgColorValue.value = color;
        }
        if (elements.gradientToggle && elements.gradientToggle.checked) {
          elements.gradientToggle.checked = false;
          updateState("useGradientBackground", false);
        }

        if (elements.bgTransparent && elements.bgTransparent.checked) {
          elements.bgTransparent.checked = false;
        }

        updateState("bg", color);
        updateBackgroundControlState();
      });
    }

    if (elements.bgTransparent) {
      elements.bgTransparent.addEventListener("change", (e) => {
        const isTransparent = e.target.checked;
        if (elements.bgColorValue) {
          elements.bgColorValue.value = isTransparent ? "transparent" : elements.bgColorPicker?.value || "#000000";
        }
        if (isTransparent && elements.gradientToggle && elements.gradientToggle.checked) {
          elements.gradientToggle.checked = false;
          updateState("useGradientBackground", false);
        }
        updateState("bg", isTransparent ? "transparent" : elements.bgColorPicker?.value || "#000000");
        updateBackgroundControlState();
      });
    }

    // Header radios
    elements.headerRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          updateState("header", e.target.value);
        }
      });
    });

    if (elements.headerSizeValue) {
      elements.headerSizeValue.addEventListener("input", (e) => {
        updateState("headerSizeValue", e.target.value);
      });
    }

    if (elements.headerSizeUnit) {
      elements.headerSizeUnit.addEventListener("change", (e) => {
        updateState("headerSizeUnit", e.target.value);
      });
    }

    if (elements.headerColorPicker) {
      elements.headerColorPicker.addEventListener("input", (e) => {
        const color = e.target.value;
        if (elements.headerColorValue) {
          elements.headerColorValue.value = color;
        }
        updateState("headerColor", color);
      });
    }

    // Block squares input
    if (elements.blockSquaresInput) {
      elements.blockSquaresInput.addEventListener("input", (e) => {
        const value = e.target.value;
        const result = validateSquareRange(value);

        validation.blockSquares = result;

        if (elements.blockSquaresError) {
          if (!result.valid) {
            elements.blockSquaresError.textContent = result.error;
            elements.blockSquaresError.style.display = "block";
            e.target.setAttribute("aria-invalid", "true");
          } else {
            elements.blockSquaresError.style.display = "none";
            e.target.removeAttribute("aria-invalid");
          }
        }

        if (result.valid) {
          updateState("blockSquares", value);
        }
      });
    }

    // Silence squares input
    if (elements.silenceSquaresInput) {
      elements.silenceSquaresInput.addEventListener("input", (e) => {
        const value = e.target.value;
        const result = validateSquareRange(value);

        validation.silenceSquares = result;

        if (elements.silenceSquaresError) {
          if (!result.valid) {
            elements.silenceSquaresError.textContent = result.error;
            elements.silenceSquaresError.style.display = "block";
            e.target.setAttribute("aria-invalid", "true");
          } else {
            elements.silenceSquaresError.style.display = "none";
            e.target.removeAttribute("aria-invalid");
          }
        }

        if (result.valid) {
          updateState("silenceSquares", value);
        }
      });
    }

    // Block domains input
    if (elements.blockDomainsInput) {
      elements.blockDomainsInput.addEventListener("input", (e) => {
        const value = e.target.value;
        const result = validateDomains(value);

        validation.domains = result;

        if (elements.blockDomainsError) {
          if (!result.valid && result.invalid.length > 0) {
            elements.blockDomainsError.textContent = `Invalid: ${result.invalid.join(", ")}`;
            elements.blockDomainsError.style.display = "block";
            e.target.setAttribute("aria-invalid", "true");
          } else {
            elements.blockDomainsError.style.display = "none";
            e.target.removeAttribute("aria-invalid");
          }
        }

        // Update state with valid domains only
        updateState("blockDomains", result.domains);
      });
    }

    // Copy buttons
    if (elements.urlCopyBtn) {
      elements.urlCopyBtn.addEventListener("click", () => {
        copyToClipboard(elements.urlOutput?.value || getEmbedUrl(), elements.urlCopyBtn);
      });
    }

    if (elements.iframeCopyBtn) {
      elements.iframeCopyBtn.addEventListener("click", () => {
        copyToClipboard(elements.iframeOutput?.value || "", elements.iframeCopyBtn);
      });
    }

    // Reset button
    if (elements.resetBtn) {
      elements.resetBtn.addEventListener("click", resetToDefaults);
    }

    updateBackgroundControlState();
    updateMobileColorSection();
  }

  // Initialize
  bindEvents();
  switchTab("mobile");
  updateOutputs();
  updatePreview();
  updateMobileColorSection();

  // Return controller
  return {
    getState: () => ({ ...state }),
    getUrl: getEmbedUrl,
    reset: resetToDefaults,
  };
}
