---
layout: article
permalink: /faq
title: Su Squares FAQ
description: Frequently asked questions about Su Squares
image: "{{ site.baseurl }}/assets/images/su-OG.png"
---

[Edit this page](https://github.com/su-squares/tenthousandsu.com/blob/master/faq.md)

# Frequently asked questions

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

## What does personalizing a Su Square NFT mean and what's it for?

When you own a Su Square NFT, you own a space on the homepage billboard corresponding to the number of your Square (Square #1 is the first square on the very top left). Personalizing a Square is when you upload data (a title, link and small image) that gets associated with your Square on the blockchain, **then** that data gets automatically displayed onto the homepage billboard in your Square's spot. *The homepage billboard updates hourly.*

## How do I split a 30×30 image into 9 10×10 images?

Please see our new [batch personalize page](personalize-batch) which does this for you.

## Why is gas cost ridonkulously high?

Because that Square is not available. You are attempting to place an order that will revert. MetaMask could do a much better job of articulating this.

![revert-tx](assets/images/revert-tx.png)

## Why are there two smart contracts? What's the "underlay" one for?

Once upon a time, Ether wasn't thousands of dollars. It later became quite expensive to personalize a Square (doing a tx and paying the fee + gas) using the main contract, "main contract" meaning the actual Su Squares contract used to determine ownership of a Square on the blockchain.

So another smart contract, an "underlay" was deployed that the homepage uses for cheaper personalization transactions. Only the owner of the NFT listed on the main contract can sign to personalize that same tokenID on the underlay contract. You personalize using the underlay smart contract **instead** of the main contract when you want your personalization to show up on the homepage billboard without paying the full gas cost of writing directly to the ownership contract.

**So basically:**  
main contract = ownership  
underlay contract = personalizing for homepage billboard

## What's ERC-721?

ERC-721 is the original Ethereum standard for NFTs (non-fungible tokens). It’s a common set of rules that smart contracts follow so that each token is unique, can be owned by only one wallet at a time, and can be transferred or viewed consistently across wallets and marketplaces.

Su Squares uses an ERC-721 smart contract on Ethereum. It was one of the first bona fide ERC-721 projects and helped pave the way for how the modern NFT ecosystem works today.


## I personalized my Square but the content I added isn't showing up. Why?

Could be a few reasons:

1. **Main contract personalization**  
   If you personalized a square a long time ago or bought one that someone else did, your square might be using the main contract still which overrides any personalization that you do through this site. You'll need to submit a transaction using the unpersonalization tool to unpersonalize it first. Then your personalization done through this site should appear, including the most recent one you may have done.  
   Once you enter your token in the form of the unpersonalization tool, it will tell you if it's been personalized on the main contract or not so you won't waste a transaction.

2. **Wrong Square**  
   Maybe you personalized a different Square. Check to make sure the token ID (the square number) matches. You may have updated a different token.

3. **Homepage hasn't updated yet**  
   The billboard homepage updates hourly; it may take some time before your new personalization appears.


## What's a Square number and what's a token ID?

There are 10,000 Su Squares, and each Square is an NFT minted on Ethereum. Each NFT has a token ID that identifies it uniquely from all the others — it will have 1 number out of 10,000. That token ID is also the Square number that you may see throughout the site, including on the billboard homepage. The billboard homepage is made up of 10,000 Squares each with a number corresponding to a token ID, so your token ID gives you a Square on that billboard to display.

If you own square number 512, then you own token ID 512, and you own a spot on the homepage billboard corresponding to square number 512. You are the only person who owns that number on the homepage billboard and on the Su Squares contract in the blockchain.

## What blockchain is Su Squares on? Is it an L2?

Ethereum.  
No L2s, side chains or rollups. This is a classic Ethereum project from way back in the OG days as it is the first bona fide ERC-721 smart contract that led the way for the entire NFT ecosystem to build on.

## Can I pay in cash or WETH to buy a Square?

To purchase directly through this site we only accept Ether. Outside of this site, you might be able to purchase it in the secondary market by whatever means.

{% include jsonld/pages/faq.html %}

