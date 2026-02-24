import { ChainKey } from "./networks.js";

const MAINNET_PRIMARY_FALLBACK = "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F";
const MAINNET_UNDERLAY_FALLBACK = "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd";

function pickAddress(chainKey, addresses, kind) {
  const chainAddresses = addresses?.[chainKey] || {};
  if (chainAddresses[kind]) return chainAddresses[kind];
  if (chainKey === ChainKey.MAINNET) {
    return kind === "primary" ? MAINNET_PRIMARY_FALLBACK : MAINNET_UNDERLAY_FALLBACK;
  }
  return null;
}

export function resolveContractAddresses(chainKey, addresses) {
  const primary = pickAddress(chainKey, addresses, "primary");
  const underlay = pickAddress(chainKey, addresses, "underlay");
  if (!primary || !underlay) {
    throw new Error(`Missing contract addresses for ${chainKey}`);
  }
  return { primary, underlay };
}
