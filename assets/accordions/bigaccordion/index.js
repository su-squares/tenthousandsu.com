/**
 * Big Accordion Component
 *
 * A reusable, accessible accordion with a large 200px header.
 * Supports keyboard navigation and screen readers.
 *
 * Usage:
 *   import { initBigAccordions, createBigAccordion } from './bigaccordion/index.js';
 *
 *   // Auto-initialize all [data-bigaccordion] elements
 *   initBigAccordions();
 *
 *   // Or create programmatically
 *   const accordion = createBigAccordion(element, { onToggle: (isOpen) => {} });
 */

const OPEN_CLASS = "is-open";
const TRANSITION_DURATION = 200; // Match CSS variable

/**
 * Creates a big accordion controller for a single element
 * @param {HTMLElement} element - The accordion container element
 * @param {Object} options - Configuration options
 * @param {Function} options.onToggle - Callback fired when accordion toggles (receives isOpen boolean)
 * @param {boolean} options.startOpen - Whether accordion should start open
 * @returns {Object} Accordion controller with open(), close(), toggle(), destroy() methods
 */
export function createBigAccordion(element, options = {}) {
  const { onToggle, startOpen = false } = options;

  const trigger = element.querySelector(".bigaccordion__trigger");
  const panel = element.querySelector(".bigaccordion__panel");
  let icon = element.querySelector(".bigaccordion__icon");

  if (!trigger || !panel) {
    console.warn(
      "BigAccordion: Missing required elements (.bigaccordion__trigger, .bigaccordion__panel)"
    );
    return null;
  }

  // Create SVG icon if it exists
  if (icon) {
    icon.innerHTML = `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g class="bigaccordion__icon-vertical">
          <line x1="16" y1="8" x2="16" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <line class="bigaccordion__icon-horizontal" x1="8" y1="16" x2="24" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </g>
      </svg>
    `;
  }

  let isOpen = startOpen;
  let isAnimating = false;

  const updateState = (open) => {
    isOpen = open;

    // Update ARIA
    trigger.setAttribute("aria-expanded", String(open));

    // Update hidden attribute (remove before opening animation)
    if (open) {
      panel.removeAttribute("hidden");
    }

    // Update classes (triggers SVG animation via CSS)
    element.classList.toggle(OPEN_CLASS, open);

    // Callback
    if (typeof onToggle === "function") {
      onToggle(open);
    }
  };

  const toggle = () => {
    if (isAnimating) return;

    isAnimating = true;
    const willOpen = !isOpen;

    if (willOpen) {
      // Opening: remove hidden first, then animate
      updateState(true);
      // Force reflow for animation
      void panel.offsetHeight;

      setTimeout(() => {
        isAnimating = false;
      }, TRANSITION_DURATION);
    } else {
      // Closing: animate first, then add hidden
      updateState(false);

      setTimeout(() => {
        if (!isOpen) {
          panel.setAttribute("hidden", "");
        }
        isAnimating = false;
      }, TRANSITION_DURATION);
    }
  };

  const open = () => {
    if (!isOpen) toggle();
  };

  const close = () => {
    if (isOpen) toggle();
  };

  // Event handlers
  const handleClick = (event) => {
    event.preventDefault();
    toggle();
  };

  const handleKeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  // Bind events
  trigger.addEventListener("click", handleClick);
  trigger.addEventListener("keydown", handleKeydown);

  // Initialize state
  if (startOpen) {
    panel.removeAttribute("hidden");
    element.classList.add(OPEN_CLASS);
    trigger.setAttribute("aria-expanded", "true");
  } else {
    panel.setAttribute("hidden", "");
    element.classList.remove(OPEN_CLASS);
    trigger.setAttribute("aria-expanded", "false");
  }

  // Cleanup function
  const destroy = () => {
    trigger.removeEventListener("click", handleClick);
    trigger.removeEventListener("keydown", handleKeydown);
  };

  return {
    element,
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    destroy,
  };
}

/**
 * Initialize all big accordions on the page
 * @param {Object} options - Default options for all accordions
 * @returns {Array} Array of accordion controllers
 */
export function initBigAccordions(options = {}) {
  const accordions = document.querySelectorAll("[data-bigaccordion]");
  const controllers = [];

  accordions.forEach((element) => {
    const startOpen = element.hasAttribute("data-bigaccordion-open");
    const controller = createBigAccordion(element, {
      ...options,
      startOpen,
    });
    if (controller) {
      controllers.push(controller);
    }
  });

  return controllers;
}
