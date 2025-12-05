import fs from "fs";
import path from "path";
import { Contract, ethers } from "ethers";

export const SETTLE_BLOCKS = 1; // Shared between event-listener and update-assets

const MAINNET_PRIMARY = "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F";
const MAINNET_UNDERLAY = "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd";
const MAINNET_DEPLOY_BLOCK = 6645906;

const ABI_PRIMARY = [
  "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
  "event Personalized(uint256 squareNumber)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)",
];

const ABI_UNDERLAY = ["event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"];

function readDeploymentJson(repoRoot, network, kind) {
  const file = path.join(repoRoot, "nodejs", "smart-contract", "contracts-deployed", `${kind}-${network}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed;
  } catch (_error) {
    return null;
  }
}

function resolveEnv(key) {
  return process.env[key] || process.env[key.toUpperCase()];
}

export function loadContractsConfig({ network, repoRoot }) {
  const upper = network.toUpperCase();
  const envPrimary = resolveEnv(`${upper}_PRIMARY_ADDRESS`);
  const envUnderlay = resolveEnv(`${upper}_UNDERLAY_ADDRESS`);
  const envTokenUriBase = resolveEnv(`${upper}_TOKEN_URI_BASE`);
  const envRpc = resolveEnv(`${upper}_RPC_URL`);

  const deploymentPrimary = readDeploymentJson(repoRoot, network, "primary");
  const deploymentUnderlay = readDeploymentJson(repoRoot, network, "underlay");

  let primaryAddress = envPrimary || deploymentPrimary?.address || null;
  let underlayAddress = envUnderlay || deploymentUnderlay?.address || null;
  let deploymentBlock =
    deploymentPrimary?.blockNumber ||
    deploymentUnderlay?.blockNumber ||
    (network === "mainnet" ? MAINNET_DEPLOY_BLOCK : null);

  if (network === "mainnet") {
    primaryAddress = primaryAddress || MAINNET_PRIMARY;
    underlayAddress = underlayAddress || MAINNET_UNDERLAY;
  }

  if (network !== "mainnet") {
    if (!primaryAddress || !underlayAddress) {
      throw new Error(
        `Missing contract addresses for ${network}. Add ${upper}_PRIMARY_ADDRESS and ${upper}_UNDERLAY_ADDRESS to nodejs/smart-contract/.env.site or contracts-deployed/*-${network}.json`,
      );
    }
    if (!deploymentBlock) {
      throw new Error(`Missing deployment block for ${network}. Add blockNumber to contracts-deployed/*-${network}.json.`);
    }
  }

  const rpcUrl =
    envRpc ||
    (network === "sunet" ? "http://127.0.0.1:8545" : null) ||
    (network === "sepolia" ? "https://rpc.sepolia.org" : null) ||
    "https://cloudflare-eth.com";

  const tokenUriBase =
    envTokenUriBase ||
    (network === "mainnet" ? "https://tenthousandsu.com/erc721/" : `http://127.0.0.1:4000/erc721-${network}/`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const suSquares = new Contract(primaryAddress, ABI_PRIMARY, provider);
  const underlay = new Contract(underlayAddress, ABI_UNDERLAY, provider);

  return { provider, suSquares, underlay, deploymentBlock, tokenUriBase };
}