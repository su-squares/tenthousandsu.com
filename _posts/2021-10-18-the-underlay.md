---
layout: article
permalink: /articles/2021-10-18-the-underlay
title: Introducing the underlay
image: "{{ site.baseurl }}/assets/images/su-OG.png"
description: "Explains the new low-cost underlay personalization contract and how it coexists with the original Su Squares contract."
---

# The underlay

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

You can now personalize your Su Squares at about 1/10th the cost. This article explains the new process and what has changed.

To personalize, go to the [TenThousandSu.com](/) homepage and click PERSONALIZE.

## The old way

The main Su Squares contract allows anybody to update their Squares by posting a transaction to the smart contract with their Square's updated image, title and URL. This can be done on the TenThousandSu.com website or using anything that interacts with smart contracts, such as Etherscan.

```solidity
function personalizeSquare(uint squareId, bytes rgbData, string title, string href) external payable;
```

This normally costs 0.01 Ether per transaction plus gas, this cost is set in the smart contract.

When you personalize your Square, your image, title and URL are saved into storage on the Ethereum Mainnet blockchain and this data is read to update the TenThousandSu.com webpage.

This way continues to work.

## The new way, the underlay

A new smart contract was deployed in 2021 to allow Su Square owners to personalize their Squares at much lower cost. Again this works on the TenThousandSu.com website and anything that interacts with smart contracts.

```solidity
function personalizeSquareUnderlay(uint squareId, bytes rgbData, string title, string href) external payable;
```

This fee is 0.001 Ether per transaction plus gas, and the gas is much lower. But why?

When you personalize your Square, your image, title and URL are saved emitted through an event (i.e. EVM log) on the Ethereum Mainnet blockchain and this data is read to update the TenThousandSu.com webpage.

**The underlay is capable of running many transactions and you can personalize all your Squares without leaving the page.**

## How do the two interact?

**We strictly respect the priority of the main Su Squares contract from 2018.**

Any Square which is personalized on the main Su Squares contract will have priority. The underlay will be effective only in the case that a Square on the main contract is not personalized, or it is personalized to:

1. All black (pixels with red=0, green=0, blue=0);
2. Title is the empty string, i.e. "" without the quotes; and
3. The URL is the empty string, i.e. "" without the quotes

In that case, any personalization you make on the underlay will show.

## What's the difference?

Here is a technical summary of the differences:

|                                                     | Main contract | Underlay         |
| --------------------------------------------------- | ------------- | ---------------- |
| Stores on blockchain                                | ✅ Yes         | ✅ Yes            |
| Fee                                                 | 0.01 Ether    | 0.001 Ether      |
| Transaction cost (at 100 Gwei, London)              | 0.0388 Ether  | 0**.**0043 Ether |
| A smart contract that owns a Square can personalize | ✅ Yes         | ✅ Yes            |
| A smart contract can query the personalization      | ✅ Yes         | ❌ No             |
{: .table-styled}

For future use cases that have been discussed, such as renting Squares using a smart contract, using a smart contract to combine or publish other information as a personalization, these are all compatible with the main contract and the underlay.

The only practical difference is that if a smart contract were deployed on-chain and it wanted to query the personalization status of a Square, it would see the main contract data and not the underlay. But for distributed-applications ("dapps"), the underlay would be just accessible as the main contract.

{% include jsonld/articles/the-underlay.html %}
