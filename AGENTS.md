# AGENTS.md — AGR Mode Router

This repository supports **AGR Mode** (Agent-Guided Repository Mode) for IDE AI assistants.

Your job is to **route** the user into one of two operating modes:

* **Tour Guide Mode**: guided exploration + getting the project running (contract + website) and completing the end-to-end mint/personalize flow.
* **Builder Mode**: making changes safely within the repo’s rules, constraints, and structure.

> IMPORTANT: If the user’s intent is unclear, you MUST ask them to choose a mode before proceeding.

---

## Always-true foundations (read/assume these before you act)

These are the minimal, stable constraints of this repo. Use them to avoid wrong assumptions:

* **Site framework:** GitHub Pages stack via the `github-pages` gem (**version:** `232`) -> `jekyll` (**version:** `3.10.0`).

  * **Ruby version:** `3.1.2` (local; confirm desired repo pin via `.ruby-version`/CI/GitHub Pages runtime)
  * **Bundler:** `2.6.9` (lockfile “BUNDLED WITH”)
* **Hosting constraint:** GitHub Pages - do **not** rely on environment variables.
* **Runtime selection (site):** The site reads runtime flags from `assets/web3/config/runtime.generated.js` (gitignored).

  * This file is **generated** from `nodejs/smart-contract/.env.site` (see the corresponding `.example` template).
  * Generate/update it via the `gen:site-config` script: `node site-scripts/gen-site-config.js`.
  * Default behavior: if runtime flags are missing, the site will behave as **mainnet**.
* **Runtime selection (contracts):** Hardhat / contract wiring (including Sepolia) is controlled via `nodejs/smart-contract/.env.contract` (see the corresponding `.example` template).
* **Runtime selection (local Besu):** The Besu local node wiring is controlled via `nodejs/smart-contract/sunet/.env.sunet` (see the corresponding `.example` template).
* **Supported networks:**

  * Local: SuNet (see `AGENTS/modes/TOUR.md` -> Phase 1: Blockchain Setup)
  * Testnet: Sepolia (see `AGENTS/modes/TOUR.md` -> Phase 1: Blockchain Setup)

*Note*: For local dev, you must comment out / exclude `erc721/` in `_config.yml` or Jekyll builds are extremely slow. This is not needed for SuNet or Sepolia development.

---

## Mode Gate: decide how to operate

### 1) Infer mode when obvious

Select **Builder Mode** if the user asks for any of the following:

* “change / add / refactor / implement”
* “fix tests / CI / lint”
* “update contracts / scripts / tooling”
* “configure a fork / deploy their own version”

Select **Tour Guide Mode** if the user asks for any of the following:

* “what is this / how does this work / history”
* “show me around / give me a tour”
* “help me run it / try it / play with it”

### 2) Ask when not obvious

If you cannot confidently infer intent, ask:

**“Do you want AGR Mode: Tour Guide, or AGR Mode: Builder?”**

If the user asks what each mode entails, open the relevant mode doc(s) below and summarize briefly.

---

## Routing: what to read next

### If TOUR GUIDE MODE

1. Open and follow:

* `AGENTS/modes/TOUR.md`

The tour guide will route you into phases:
* Phase 1 Sepolia: `AGENTS/modes/tour/PHASE-1-SEPOLIA.md`
* Phase 1 SuNet: `AGENTS/modes/tour/PHASE-1-SUNET.md`
* Phase 2 Sepolia: `AGENTS/modes/tour/PHASE-2-SEPOLIA.md`
* Phase 2 SuNet: `AGENTS/modes/tour/PHASE-2-SUNET.md`
* Phase 3 Main: `AGENTS/modes/tour/PHASE-3-MAIN.md`
* Phase 3 Sepolia: `AGENTS/modes/tour/PHASE-3-SEPOLIA.md`
* Phase 3 SuNet: `AGENTS/modes/tour/PHASE-3-SUNET.md`
* Phase 4 Main: `AGENTS/modes/tour/PHASE-4-MAIN.md`
* Phase 5 Builder: `AGENTS/modes/tour/PHASE-5-BUILDER.md`
* Phase 6 Vitest: `AGENTS/modes/tour/PHASE-6-VITEST.md`
* Phase 7 Storybook: `AGENTS/modes/tour/PHASE-7-STORYBOOK.md`
* Phase 8 Playwright: `AGENTS/modes/tour/PHASE-8-PLAYWRIGHT.md`

2. Tour mode safety rule:

* Do **not** modify code by default.
* If code changes are required to proceed, propose the minimal change and ask the user whether to switch to **Builder Mode**.

### If BUILDER MODE

1. Open and follow:

* `AGENTS/modes/BUILDER.md`

2. Builder mode safety rule:

* Follow repo constraints and invariants.
* Do not add dependencies unless justified under the dependency policy.
* Respect GitHub Pages constraints (no env vars; use runtime flag file).

---

## Quick response conventions (for both modes)

* Prefer short, numbered steps.
* Provide copy/paste-ready commands when relevant.
* Confirm success at each phase before advancing.
* If an error occurs, request the exact output and unblock with the smallest fix.
