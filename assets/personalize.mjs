import {
  squareContractAddress, squareContractABI, underlayContractAddress, underlayContractABI,
  pricePerSquare, priceInEther, parseBatch, validatePersonalizations, loadOwnedPage, verifyOwnership, isAnimatedImage
} from "./personalization.mjs";

const connectButton = document.getElementById("connect-wallet");
const walletStatus = document.getElementById("wallet-status");
const noSquares = document.getElementById("no-squares");
const ownedSection = document.getElementById("owned-squares");
const squaresList = document.getElementById("squares-list");
const loadMoreButton = document.getElementById("load-more");
const personalizeButton = document.getElementById("personalize");
const confirmation = document.getElementById("confirmation");
const receipts = document.getElementById("receipts");
const batchInput = document.getElementById("preflight-output");
const validationStatus = document.getElementById("preflight-status");
const validateButton = document.getElementById("validate");
const rows = new Map();
let activeAddress;
let session = 0;
let balance = 0;
let loaded = 0;
let loading = false;
let sending = false;
let validating = false;
let validatedBatch = null;
let batchRevision = 0;
let metadata;

function updateConfirmation() {
  const count = batchInput ? (validatedBatch?.length || 0) : [...rows.values()].filter(row => row.selected.checked).length;
  confirmation.textContent = batchInput && !validatedBatch
    ? "Validate your batch data before personalizing."
    : `Click this button to personalize the ${count} selected Squares.`;
  personalizeButton.textContent = `Personalize\u2014${priceInEther(count)} ETH`;
  personalizeButton.disabled = !count || sending || validating || !activeAddress;
  squaresList.querySelectorAll("input").forEach(input => { input.disabled = sending; });
  loadMoreButton.disabled = sending || loading;
  if (batchInput) {
    batchInput.disabled = sending;
    validateButton.disabled = sending || validating;
  }
}

function invalidateBatch() {
  batchRevision++;
  validatedBatch = null;
  validationStatus.textContent = "Not yet validated.";
  updateConfirmation();
}

function showError(element, error) {
  console.error(error);
  element.textContent = `Error: ${error.message}`;
}

async function loadMetadata() {
  const response = await fetch("/build/squarePersonalizations.json");
  if (!response.ok) throw new Error("Unable to load current Square titles and links. Please reload to try again.");
  return response.json();
}

function appendSquare(squareId) {
  const id = Number(squareId);
  if (batchInput) {
    const item = document.createElement("li");
    item.textContent = `#${id}`;
    squaresList.append(item);
    return;
  }
  const tr = document.createElement("tr");
  const cell = () => tr.appendChild(document.createElement("td"));
  const selected = document.createElement("input");
  selected.type = "checkbox";
  selected.setAttribute("aria-label", `Select Square #${id}`);
  selected.checked = new URLSearchParams(location.search).get("square") === String(id);
  cell().append(selected);
  const thumbnail = document.createElement("span");
  thumbnail.className = "personalize-thumbnail";
  thumbnail.style.backgroundPosition = `-${((id - 1) % 100) * 50}px -${Math.floor((id - 1) / 100) * 50}px`;
  thumbnail.setAttribute("role", "img");
  thumbnail.setAttribute("aria-label", `Current image for Square #${id}`);
  const link = document.createElement("a");
  link.href = `/square#${id}`;
  link.textContent = `#${id}`;
  cell().append(thumbnail, link);
  const title = document.createElement("input");
  title.type = "text";
  title.value = metadata[id - 1]?.[0] || "";
  title.setAttribute("aria-label", `Title for Square #${id}`);
  cell().append(title);
  const href = document.createElement("input");
  href.type = "text";
  href.value = metadata[id - 1]?.[1] || "";
  href.setAttribute("aria-label", `Link for Square #${id}`);
  cell().append(href);
  const image = document.createElement("input");
  image.type = "file";
  image.accept = "image/png,image/jpeg,image/gif";
  image.setAttribute("aria-label", `Upload image for Square #${id}`);
  const imageStatus = document.createElement("p");
  imageStatus.textContent = "No image selected.";
  imageStatus.setAttribute("role", "status");
  const preview = document.createElement("canvas");
  preview.width = 10;
  preview.height = 10;
  preview.className = "personalize-image-preview";
  preview.hidden = true;
  cell().append(image, imageStatus, preview);
  const row = { selected, title, href, image, imageStatus, preview, rgbData: null, imageRevision: 0 };
  rows.set(id, row);
  selected.addEventListener("change", updateConfirmation);
  image.addEventListener("change", () => loadImage(row));
  squaresList.append(tr);
}

async function loadImage(row) {
  const revision = ++row.imageRevision;
  row.rgbData = null;
  row.preview.hidden = true;
  const file = row.image.files[0];
  if (!file) {
    row.imageStatus.textContent = "No image selected.";
    return;
  }
  row.imageStatus.textContent = "Loading image...";
  let objectURL;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = String.fromCharCode(...bytes.slice(0, 4));
    if (signature !== "\x89PNG" && !signature.startsWith("GIF") && !(bytes[0] === 255 && bytes[1] === 216)) {
      throw new Error("Please upload a PNG, JPEG or GIF image.");
    }
    if (isAnimatedImage(bytes)) {
      throw new Error("Animated images are not supported. Please use a non-animated image.");
    }
    objectURL = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectURL;
    await image.decode();
    if (image.naturalWidth !== 10 || image.naturalHeight !== 10) {
      throw new Error("Image must be exactly 10 by 10 pixels.");
    }
    if (revision !== row.imageRevision) return;
    const context = row.preview.getContext("2d");
    if (!context) throw new Error("Unable to read image pixels. Please enable canvas access in your browser.");
    context.clearRect(0, 0, 10, 10);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 10, 10).data;
    let rgbData = "0x";
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 255) throw new Error("Image must be opaque. Remove transparency and upload it again.");
      rgbData += [...pixels.slice(i, i + 3)].map(channel => channel.toString(16).padStart(2, "0")).join("");
    }
    row.rgbData = rgbData;
    row.preview.hidden = false;
    row.imageStatus.textContent = "Image ready (shown enlarged).";
  } catch (error) {
    if (revision === row.imageRevision) showError(row.imageStatus, error);
  } finally {
    if (objectURL) URL.revokeObjectURL(objectURL);
  }
}

async function start() {
  window.process = { env: { NODE_ENV: "development" } };
  const { Web3modal, WagmiCore, Chains } = await import(
    "https://cdn.jsdelivr.net/npm/@web3modal/cdn@5.1.11/dist/wagmi.js"
  );
  const { reconnect, getAccount, watchAccount, readContract, writeContract, waitForTransactionReceipt } = WagmiCore;
  const projectId = "2aca272d18deb10ff748260da5f78bfd";
  const chains = [Chains.mainnet];
  const config = Web3modal.defaultWagmiConfig({
    chains, projectId,
    metadata: {
      name: "Su Squares", description: "Own a piece of the Ethereum blockchain",
      url: "https://tenthousandsu.com",
      icons: ["https://tenthousandsu.com/assets/images/branding/logo-su-squares.svg"]
    }
  });
  const modal = Web3modal.createWeb3Modal({ wagmiConfig: config, projectId, chains });
  connectButton.addEventListener("click", () => modal.open());
  const readSquare = (functionName, args) => readContract(config, {
    chainId: 1, address: squareContractAddress, abi: squareContractABI, functionName, args
  });

  async function loadMore() {
    if (loading || !activeAddress) return;
    const currentSession = session;
    const address = activeAddress;
    loading = true;
    loadMoreButton.disabled = true;
    walletStatus.textContent = "Loading your Squares...";
    try {
      const ids = await loadOwnedPage(readSquare, address, loaded, balance);
      if (currentSession !== session) return;
      ids.forEach(appendSquare);
      loaded += ids.length;
      ownedSection.hidden = false;
      loadMoreButton.hidden = loaded >= balance;
      walletStatus.textContent = `Showing ${loaded} of your ${balance} Squares.`;
      updateConfirmation();
    } catch (error) {
      if (currentSession !== session) return;
      showError(walletStatus, error);
      // Keep a retry available even if the first page failed.
      loadMoreButton.hidden = false;
      ownedSection.hidden = false;
    } finally {
      if (currentSession === session) {
        loading = false;
        updateConfirmation();
      }
    }
  }

  async function updateAccount(account) {
    connectButton.textContent = account.isConnected
      ? `Connected: ${account.address.slice(0, 6)}\u2026${account.address.slice(-4)}`
      : "Connect wallet";
    const address = account.isConnected ? account.address : undefined;
    if (address === activeAddress) return;
    activeAddress = address;
    const currentSession = ++session;
    rows.clear();
    squaresList.replaceChildren();
    ownedSection.hidden = true;
    noSquares.hidden = true;
    loadMoreButton.hidden = true;
    balance = loaded = 0;
    loading = validating = sending = false;
    if (validateButton) validateButton.disabled = false;
    receipts.replaceChildren();
    if (batchInput) invalidateBatch();
    updateConfirmation();
    walletStatus.textContent = address ? "Loading your Squares..." : "";
    if (!address) return;
    try {
      const ownedBalance = await readSquare("balanceOf", [address]);
      if (currentSession !== session) return;
      balance = Number(ownedBalance);
      if (!balance) {
        noSquares.hidden = false;
        walletStatus.textContent = "";
        return;
      }
      if (!batchInput) {
        const loadedMetadata = await loadMetadata();
        if (currentSession !== session) return;
        metadata = loadedMetadata;
      }
      await loadMore();
    } catch (error) {
      if (currentSession === session) showError(walletStatus, error);
    }
  }

  function requireCurrentAccount(address, currentSession) {
    const account = getAccount(config);
    if (currentSession !== session || !account.isConnected || account.address !== address) {
      throw new Error("Wallet changed. Review your Squares and try again.");
    }
    if (account.chainId !== 1) throw new Error("Please switch your wallet to Ethereum mainnet and try again.");
  }

  loadMoreButton.addEventListener("click", loadMore);
  if (batchInput) {
    batchInput.addEventListener("input", invalidateBatch);
    validateButton.addEventListener("click", async () => {
      invalidateBatch();
      const revision = batchRevision;
      const currentSession = session;
      const address = activeAddress;
      validating = true;
      validateButton.disabled = true;
      validationStatus.textContent = "Validating format and on-chain ownership...";
      try {
        requireCurrentAccount(address, currentSession);
        const args = parseBatch(batchInput.value);
        await verifyOwnership(readSquare, address, args);
        if (revision !== batchRevision) return;
        requireCurrentAccount(address, currentSession);
        validatedBatch = args;
        validationStatus.textContent = `Valid: ${args.length} Squares. Format and wallet ownership confirmed.`;
      } catch (error) {
        if (currentSession === session && revision === batchRevision) showError(validationStatus, error);
      } finally {
        if (currentSession === session) {
          validating = false;
          validateButton.disabled = false;
          updateConfirmation();
        }
      }
    });
  }

  personalizeButton.addEventListener("click", async () => {
    if (sending) return;
    const address = activeAddress;
    const currentSession = session;
    sending = true;
    updateConfirmation();
    try {
      requireCurrentAccount(address, currentSession);
      const args = batchInput ? validatedBatch : validatePersonalizations(
        [...rows.entries()].filter(([, row]) => row.selected.checked).map(([id, row]) => ({
          squareId: BigInt(id), title: row.title.value, href: row.href.value, rgbData: row.rgbData
        }))
      );
      if (!args) throw new Error("Validate your batch data before personalizing.");
      const revision = batchRevision;
      receipts.textContent = "Checking wallet ownership...";
      await verifyOwnership(readSquare, address, args);
      requireCurrentAccount(address, currentSession);
      if (batchInput && revision !== batchRevision) throw new Error("Batch data changed. Validate it again.");
      receipts.textContent = "Sending transaction, waiting for confirmation...";
      const hash = await writeContract(config, {
        chainId: 1, account: address,
        address: underlayContractAddress, abi: underlayContractABI,
        functionName: "personalizeSquareUnderlayBatch",
        args: [args], value: BigInt(args.length) * pricePerSquare
      });
      const receipt = await waitForTransactionReceipt(config, { chainId: 1, hash });
      if (currentSession !== session) return;
      if (receipt.status !== "success") throw new Error("Transaction reverted. Your Squares were not personalized.");
      const transactionLink = document.createElement("a");
      transactionLink.href = `https://etherscan.io/tx/${receipt.transactionHash}`;
      transactionLink.target = "_blank";
      transactionLink.rel = "noopener";
      transactionLink.textContent = receipt.transactionHash;
      receipts.replaceChildren("Transaction confirmed. Transaction ID: ", transactionLink,
        ". Your images will show on the Su Squares homepage, which refreshes hourly.");
    } catch (error) {
      if (currentSession === session) showError(receipts, error);
    } finally {
      if (currentSession === session) {
        sending = false;
        updateConfirmation();
      }
    }
  });

  watchAccount(config, { onChange: updateAccount });
  await updateAccount(getAccount(config));
  await reconnect(config);
}

start().catch(error => showError(walletStatus, error));
