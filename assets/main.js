///
/// Su Squares application
///
/// This requires web3.js to be loaded and an EIP-1193 compliant provider
/// such as MetaMask ^9.2.0 or similar software
///

/* Reusable Ethereum application class ****************************************/
function EthereumApplication() {
  /// Protected variable to be used by extensions of this class
  const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

  /// Promise(bool) of whether web3 provider is connected
  const isConnected = web3.eth.getBlockNumber().then(value => value > 0);

  /// Promise(bool) of whether we are on the billable production network
  const isNetworkCorrect = web3.eth.net.getId().then(value => value === 1);

  /// This requires authorizing the app
  // https://github.com/ChainSafe/web3.js/issues/2091#issuecomment-787637817
  const mainAccount = web3.eth.requestAccounts().then(value => value[0]);

  return {
    web3,
    isConnected,
    isNetworkCorrect,
    mainAccount
  }
};

/* Su Squares smart contract application class ********************************/
function SuSquaresApplication() {
  /// The deployed contract address (on Ethereum Mainnet)
  const contractAddress = "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F";

  /// Contract JSON ABI
  const contractJSON = [
    {"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_operator","type":"address"},{"indexed":false,"name":"_approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},
    {"constant":false,"inputs":[{"name":"_approved","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"approve","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"constant":false,"inputs":[{"name":"_tokenId","type":"uint256"},{"name":"_newOwner","type":"address"}],"name":"grantToken","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":false,"name":"_nftId","type":"uint256"}],"name":"Personalized","type":"event"},
    {"constant":false,"inputs":[{"name":"_squareId","type":"uint256"},{"name":"_rgbData","type":"bytes"},{"name":"_title","type":"string"},{"name":"_href","type":"string"}],"name":"personalizeSquare","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"},{"indexed":true,"name":"_tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_approved","type":"address"},{"indexed":true,"name":"_tokenId","type":"uint256"}],"name":"Approval","type":"event"},
    {"constant":false,"inputs":[{"name":"_nftId","type":"uint256"}],"name":"purchase","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"},{"name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"constant":false,"inputs":[{"name":"_operator","type":"address"},{"name":"_approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":false,"inputs":[{"name":"_executiveOfficerAddress","type":"address"}],"name":"setExecutiveOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":false,"inputs":[{"name":"_financialOfficerAddress","type":"address"}],"name":"setFinancialOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":false,"inputs":[{"name":"_operatingOfficerAddress","type":"address"}],"name":"setOperatingOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},
    {"constant":false,"inputs":[],"name":"withdrawBalance","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},
    {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"executiveOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"financialOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"pure","type":"function"},
    {"constant":true,"inputs":[],"name":"operatingOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"_owner","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"promoCreatedCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"interfaceID","type":"bytes4"}],"name":"supportsInterface","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"suSquares","outputs":[{"name":"version","type":"uint256"},{"name":"rgbData","type":"bytes"},{"name":"title","type":"string"},{"name":"href","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"pure","type":"function"},
    {"constant":true,"inputs":[{"name":"_index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"name":"_tokenId","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"name":"_tokenURI","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}
  ];

  /// Subclass
  const app = new EthereumApplication();

  app.contract = new app.web3.eth.Contract(contractJSON, contractAddress);

  app.getSquareFromUrl = function() {
    return new URLSearchParams(window.location.search).get("square");
  };

  /* Transaction wrappers to blockchain ***************************************/

  /**
   * Call to blockchain, get count
   * @returns Promise wrapping the transaction
   */
  app.callBalance = async function() {
    const mainAccount = await app.mainAccount;
    return app.contract.methods.balanceOf(mainAccount).call();
  };

  /**
   * Call to blockchain, get their n-th token ID
   * @param {number} index 
   * @returns Promise wrapping the transaction
   */
  app.callTokenByIndex = async function(index) {
    const mainAccount = await app.mainAccount;
    return app.contract.methods.tokenOfOwnerByIndex(mainAccount, index).call()
  };

  /**
   * Call to blockchain, get information about a Square
   * @param {number} squareNumber
   * @returns Promise wrapping the transaction
   */
  app.callSuSquares = async function(squareNumber) {
    const mainAccount = await app.mainAccount;
    return app.contract.methods.suSquares(squareNumber).call()
  };

  /**
   * Send to blockchain, with 500 Finney cost
   * @param {number} squareNumber 
   * @returns Promise wrapping the transaction
   */
   app.sendBuy = async function(squareNumber) {
    if (squareNumber < 1 || squareNumber > 10000) {
      return Promise.reject(new Error("Square number must between 1 and 10,000, inclusive"));
    }
    const method = app.contract.methods.purchase(squareNumber);
    const mainAccount = await app.mainAccount;
    return method.send({
      value: app.web3.utils.toWei("500", "finney"),
      from: mainAccount
    });
  };

  /**
   * Send personalization to the blockchain, with fee as specified
   * @param {number} squareNumber 
   * @param {Array.<number>} pixelData
   * @param {String} title 
   * @param {String} url 
   * @param {String} fee String representing a number of wei
   * @returns Promise wrapping the transaction
   */
  const sendPersonalize = async function(squareNumber, pixelData, title, url, value) {
    if (squareNumber < 1 || squareNumber > 10000) {
      return Promise.reject(new Error("Square number must between 1 and 10,000, inclusive"));
    }
    if (title.length > 64) {
      return Promise.reject(new Error("Title must not exceed 64 bytes"));
    }
    if (url.length > 96) {
      return Promise.reject(new Error("URL must not exceed 96 bytes"));
    }
    if (!url.startsWith("https://")) {
      return Promise.reject(new Error("Currently only https:// URLs are supported"));
    }
    if (pixelData.length != 300) {
      return Promise.reject(new Error("There is a problem with your image"));
    }
    
    // Encode pixel data for wire format, like 0x and then each channel/pixel
    const pixelDataWire = "0x" + pixelData.map(i=>i.toString(16).padStart(2, "0")).join("");
    if (pixelDataWire.length !== 602) {
      return Promise.reject(new Error("There is a problem with encoding your image"));
    }

    const method = app.contract.methods.personalizeSquare(squareNumber, pixelDataWire, title, url);
    const mainAccount = await app.mainAccount;
    return method.send({
      value: value,
      from: mainAccount
    });
  };

  /**
   * Send to blockchain, with no fee
   * @param {number} squareNumber 
   * @param {Array.<number>} pixelData
   * @param {String} title 
   * @param {String} url 
   * @returns Promise wrapping the transaction
   */
  app.sendPersonalizeFree = function(squareNumber, pixelData, title, url) {
    return sendPersonalize(squareNumber, pixelData, title, url, "0");
  };

  /**
   * Send to blockchain, with 10 Finney fee
   * @param {number} squareNumber 
   * @param {Array.<number>} pixelData
   * @param {String} title 
   * @param {String} url 
   * @returns Promise wrapping the transaction
   */
   app.sendPersonalizeWithTenFinney = function(squareNumber, pixelData, title, url) {
    const value = app.web3.utils.toWei("10", "finney");
    return sendPersonalize(squareNumber, pixelData, title, url, value);
  };

  return app;
};
