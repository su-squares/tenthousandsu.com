export interface StubSquareMeta {
  id: number;
  label: string;
  minted: boolean;
  personalized: boolean;
}

const STUB_SQUARES: StubSquareMeta[] = [
  { id: 1, label: "Genesis OG", minted: true, personalized: true },
  { id: 2, label: "Diamond Hands", minted: true, personalized: false },
  { id: 3, label: "Pixel Wizard", minted: true, personalized: false },
  { id: 4, label: "Rare Artifact", minted: true, personalized: true },
  { id: 5, label: "Unminted #5", minted: false, personalized: false },
  { id: 6, label: "Unminted #6", minted: false, personalized: false },
  { id: 7, label: "Collector's Choice", minted: true, personalized: true },
  { id: 8, label: "Vaulted Square", minted: true, personalized: false },
  { id: 9, label: "Streamer Collab", minted: true, personalized: true },
  { id: 10, label: "OG Supporter", minted: true, personalized: false },
  { id: 11, label: "Event Exclusive", minted: true, personalized: true },
  { id: 12, label: "Reserved #12", minted: false, personalized: false },
  { id: 13, label: "Hidden Relic", minted: true, personalized: true },
  { id: 14, label: "Mystery Box", minted: false, personalized: false },
  { id: 15, label: "Retro Vibes", minted: true, personalized: false },
  { id: 16, label: "Neon Dream", minted: true, personalized: true },
  { id: 17, label: "Cyber Relic", minted: false, personalized: false },
  { id: 18, label: "Infinity Loop", minted: true, personalized: true },
  { id: 19, label: "The Vault", minted: true, personalized: false },
  { id: 20, label: "Su Core", minted: true, personalized: true },
  { id: 21, label: "Legacy Node", minted: true, personalized: false },
  { id: 22, label: "Rare Mint", minted: false, personalized: false },
  { id: 23, label: "Dream Chaser", minted: true, personalized: true },
  { id: 24, label: "Night Coder", minted: true, personalized: true },
  { id: 25, label: "Unminted #25", minted: false, personalized: false },
  { id: 26, label: "Beta Tester", minted: true, personalized: false },
  { id: 27, label: "Chain Breaker", minted: true, personalized: true },
  { id: 28, label: "Metaverse Key", minted: true, personalized: false },
  { id: 29, label: "Quantum Artifact", minted: true, personalized: true },
  { id: 30, label: "Genesis Clone", minted: false, personalized: false },
  { id: 31, label: "Vault Beta", minted: true, personalized: true },
  { id: 32, label: "Rogue Trader", minted: true, personalized: false },
  { id: 33, label: "NFT OG", minted: true, personalized: true },
  { id: 34, label: "Parallel Realm", minted: false, personalized: false },
  { id: 35, label: "Legendary Mint", minted: true, personalized: true },
  { id: 36, label: "Prototype Unit", minted: false, personalized: false },
  { id: 37, label: "Portal Gate", minted: true, personalized: true },
  { id: 38, label: "Experimental #38", minted: true, personalized: false },
  { id: 39, label: "Treasure Code", minted: true, personalized: true },
  { id: 40, label: "Unlocked Realm", minted: true, personalized: false },
  { id: 41, label: "Builder’s Token", minted: true, personalized: true },
  { id: 42, label: "Random Drop", minted: false, personalized: false },
  { id: 43, label: "Su Networker", minted: true, personalized: true },
  { id: 44, label: "Art Collector", minted: true, personalized: false },
  { id: 45, label: "Rare Sketch", minted: false, personalized: false },
  { id: 46, label: "Dev Mode", minted: true, personalized: true },
  { id: 47, label: "Mainnet OG", minted: true, personalized: false },
  { id: 48, label: "Alpha Square", minted: true, personalized: true },
  { id: 49, label: "Beta Square", minted: false, personalized: false },
  { id: 50, label: "Gamma Square", minted: true, personalized: true },
  { id: 51, label: "Delta Square", minted: true, personalized: false },
  { id: 52, label: "Epsilon Square", minted: false, personalized: false },
  { id: 53, label: "Zeta Square", minted: true, personalized: true },
  { id: 54, label: "Eta Square", minted: true, personalized: false },
  { id: 55, label: "Theta Square", minted: true, personalized: true },
  { id: 56, label: "Iota Square", minted: false, personalized: false },
  { id: 57, label: "Kappa Square", minted: true, personalized: true },
  { id: 58, label: "Lambda Square", minted: true, personalized: false },
  { id: 59, label: "Mu Square", minted: true, personalized: true },
  { id: 60, label: "Nu Square", minted: false, personalized: false },
  { id: 61, label: "Xi Square", minted: true, personalized: true },
  { id: 62, label: "Omicron Square", minted: true, personalized: false },
  { id: 63, label: "Pi Square", minted: true, personalized: true },
  { id: 64, label: "Rho Square", minted: false, personalized: false },
  { id: 65, label: "Sigma Square", minted: true, personalized: true },
  { id: 66, label: "Tau Square", minted: true, personalized: false },
  { id: 67, label: "Upsilon Square", minted: true, personalized: true },
  { id: 68, label: "Phi Square", minted: false, personalized: false },
  { id: 69, label: "Chi Square", minted: true, personalized: true },
  { id: 70, label: "Psi Square", minted: true, personalized: false },
  { id: 71, label: "Omega Square", minted: true, personalized: true },
  { id: 72, label: "Mirror Relic", minted: false, personalized: false },
  { id: 73, label: "Aether Core", minted: true, personalized: true },
  { id: 74, label: "Void Runner", minted: true, personalized: false },
  { id: 75, label: "Galaxy Node", minted: true, personalized: true },
  { id: 76, label: "Chrono Key", minted: false, personalized: false },
  { id: 77, label: "Neural Artifact", minted: true, personalized: true },
  { id: 78, label: "Data Cube", minted: true, personalized: false },
  { id: 79, label: "Binary Ghost", minted: true, personalized: true },
  { id: 80, label: "Light Fragment", minted: false, personalized: false },
  { id: 81, label: "Dark Energy", minted: true, personalized: true },
  { id: 82, label: "Solar Flare", minted: true, personalized: false },
  { id: 83, label: "Lunar Echo", minted: true, personalized: true },
  { id: 84, label: "Quantum Loop", minted: false, personalized: false },
  { id: 85, label: "Ether Relic", minted: true, personalized: true },
  { id: 86, label: "Crystal Node", minted: true, personalized: false },
  { id: 87, label: "Meta Genesis", minted: true, personalized: true },
  { id: 88, label: "Rare Unminted", minted: false, personalized: false },
  { id: 89, label: "Temporal Key", minted: true, personalized: true },
  { id: 90, label: "Singularity", minted: true, personalized: false },
  { id: 91, label: "Fractal Core", minted: true, personalized: true },
  { id: 92, label: "Cosmic Dust", minted: false, personalized: false },
  { id: 93, label: "Echo Chain", minted: true, personalized: true },
  { id: 94, label: "Fusion Node", minted: true, personalized: false },
  { id: 95, label: "Celestial Grid", minted: true, personalized: true },
  { id: 96, label: "Parallel Key", minted: false, personalized: false },
  { id: 97, label: "Legend’s Relic", minted: true, personalized: true },
  { id: 98, label: "Spectral Mint", minted: true, personalized: false },
  { id: 99, label: "Digital Totem", minted: true, personalized: true },
  { id: 100, label: "Final Prototype", minted: false, personalized: false }
];

/**
 * Storybook-only stub that mimics the shape of the real loadSquareData.
 */
export async function loadSquareData(): Promise<{
  personalizations: (string | null)[];
  extra: ({ minted: boolean; personalized: boolean } | null)[];
}> {
  const personalizations = STUB_SQUARES.map((sq) => sq.label);
  const extra = STUB_SQUARES.map((sq) => ({
    minted: sq.minted,
    personalized: sq.personalized
  }));

  return {
    personalizations,
    extra
  };
}
