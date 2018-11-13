///
/// Su Squares application
/// Requires MetaMask ^5.0.2 or similar
///

/* Reusable Ethereum application **********************************************/
EthereumApplication = function(){
  this.web3 = new Promise((resolve, reject) => {
    window.addEventListener('load', async () => {
      if (window.ethereum) {
        resolve(new Web3(window.ethereum));
      } else if (typeof web3 !== 'undefined') {
        resolve(new Web3(web3.currentProvider));
      } else {
        reject(new Error('No web3 environment available, install MetaMask or similar'));
      }
    });
  });

  this.networkId = new Promise(async (resolve, reject) => {
    try {
      web3 = await this.web3;
      web3.version.getNetwork((err, netId) => {
        if (netId == '1') {
          resolve(netId);
        } else {
          reject(new Error('Got incorrect network ID: ' + netId));
        }
      });
    } catch (error) {
      reject(error);
    }
  });

  this.accessEnabled = new Promise(async (resolve, reject) => {
    try {
      web3 = await this.web3;
      if (window.ethereum) {
        try {
          await window.ethereum.enable();
          resolve(true);
          return;
        } catch (error) {
          reject(error);
        }
      } else if (typeof web3 !== 'undefined') {
        resolve(true);
      } else {
        reject(new Error('Cannot enable unknown network setup'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

/* Su Squares smart contract **************************************************/
window.suSquaresApplication = function() {
  app = new EthereumApplication();

  app.contractAddress = '0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F' // mainnet

  app.contractABI = [{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_operator","type":"address"},{"indexed":false,"name":"_approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"constant":false,"inputs":[{"name":"_approved","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"approve","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_tokenId","type":"uint256"},{"name":"_newOwner","type":"address"}],"name":"grantToken","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_nftId","type":"uint256"}],"name":"Personalized","type":"event"},{"constant":false,"inputs":[{"name":"_squareId","type":"uint256"},{"name":"_rgbData","type":"bytes"},{"name":"_title","type":"string"},{"name":"_href","type":"string"}],"name":"personalizeSquare","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"},{"indexed":true,"name":"_tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_approved","type":"address"},{"indexed":true,"name":"_tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"constant":false,"inputs":[{"name":"_nftId","type":"uint256"}],"name":"purchase","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"},{"name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_operator","type":"address"},{"name":"_approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_executiveOfficerAddress","type":"address"}],"name":"setExecutiveOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_financialOfficerAddress","type":"address"}],"name":"setFinancialOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_operatingOfficerAddress","type":"address"}],"name":"setOperatingOfficer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"withdrawBalance","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"executiveOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"financialOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[],"name":"operatingOfficerAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"_owner","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"promoCreatedCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"interfaceID","type":"bytes4"}],"name":"supportsInterface","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"suSquares","outputs":[{"name":"version","type":"uint256"},{"name":"rgbData","type":"bytes"},{"name":"title","type":"string"},{"name":"href","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"name":"_index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"name":"_tokenId","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"name":"_tokenURI","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}];

  app.contract = new Promise(async (resolve, reject) => {
    try {
      web3 = await app.web3;
      await app.networkId;
      await app.accessEnabled;
      resolve(web3.eth.contract(app.contractABI).at(app.contractAddress));
    } catch (error) {
      reject(error);
    }
  });

  app.getSquareFromUrl = function() {
    var url = window.location.href;
    var regex = /=([0-9]+)/;
    var results = regex.exec(url);
    if (!results) return null;
    return results[1];
  }
  return app;
}();
