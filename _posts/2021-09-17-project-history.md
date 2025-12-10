---
layout: article
permalink: /articles/2021-09-17-project-history
title: Project history
image: "{{ site.baseurl }}/assets/images/su-OG.png"
description: "Summarizes Su Squares' origins, ERC-721 involvement, and a detailed timeline of the project milestones."
---

# Project history

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

Su Squares are cute squares you own and personalize, displayed on TenThousandSu.com and accounted for on Ethereum<sup>&reg;</sup> Mainnet. This article tells why Su Squares are the first ERC-721 digital collectable for sale and the authoritative history of the project.

## Founders' background

**Su Entriken** is from Hefei, China, and **William Entriken** is from Philadelphia, USA. Su & William have been married since 2014 and enjoy travel, art and fun. They operate a boudoir photography business together, started as their first hobbypreneurship.

## The idea

In the back of their minds while William was learning about Ethereum, Su and William decided to sell some digital collectable project or "some blockchain thing". At the time, most blockchain projects were "shitcoins" and this inspired the original name for this project, Su Coin. As the project took form, heavy inspiration came from the Million Dollar Homepage. The simple idea was finally published as **Su Squares**.

In early 2018, Su went on a business trip to Manila. This gave William some free nights to play and learn about Ethereum.

## The ERC-721 standard

William was introduced to the Ethereum community by childhood friend Robert Leshner (CEO, [compound.finance](https://compound.finance), also Philadelphia region) in late 2017 and looked to find a fun place to start. With his [background in open source](https://github.com/fulldecent) and developer community building from working at Google, the US Department of Defense and on Linux/iOS projects, William looked to contribute to Ethereum by being a mentor for bringing new people into the project. He found the non-fungible tokens (NFT) initiative and immediately recognized this was the main value proposition for distributed ledgers. (A very unpopular value assessment at the time and maybe still so today.)

At the time, CryptoKitties was clearly the most active, liquid, and fun NFT project. These colorful pictures of cats, with breeding game mechanics, auctions and gene-splicing show a delightful, well-designed product that went on to achieve great commercial success. As many would-be copycats rushed to steal these ideas, developers with varying levels of experience needed guidance from mentors and specification authors to build their product. This is the time William joined the scene.

Several competing standards worked to define an interoperable ecosystem of smart contracts, wallets and marketplaces for NFTs. Through sheer hard work, rewriting drafts daily and taking phone calls personally from anybody with an opinion, **William earned the role of lead author of the standard ERC-841, later renamed ERC-721. With his coauthors**, this standard passed with unanimous consent, all competing standards were withdrawn and for years no replacement or extension has been formally proposed.

The chosen approach for overcoming technical objections to ERC-721 has been to lead by example. Some people objected that because the CryptoKitties smart contract does not scale (see "blow past the block gas limit" note in KittyOwnership.sol) then ERC-721 cannot be scalable. To verify scalability, a contract was deployed with more tokens than any practical application could ever want, (see "nanobots" devouring Earth in ERC-721). Complaints about Solidity (a smart contract language) were resolved by fixing Solidity. Complaints about the ERC standards process were solved by changing the ERC standards process.

Every change also brought a specific and unreconciled complaint:

> :angry: William keeps approving changes to the draft standard, it's easy for him to talk but difficult for everybody else to implement these changes, he has no skin in the game.

Addressing this is the birth of Su Squares. During the draft process for ERC-721, William deployed Su Squares to Ethereum Mainnet and began selling squares commercially. Every time an incompatible change to the standard was proposed, William needed to pay to redeploy the Su Squares smart contract, apologize to customers, and then migrate each customers' purchase onto the new smart contract. He was now firmly in the same circumstance as others using the standard.

Redeploying sucks. As William and coauthors considered the last major normative change to the standard—adding the `operator` parameter to the `onERC721Received` callback—William weighed the cost of yet again redeploying Su Squares and everyone else's time to make changes versus the value of this new feature. The change was accepted, again with community support.

The standard was finalized June 21, 2018 on Su's birthday.

## Compliance

Su Squares, the 0xcert reference implementation and the nanobots scalable implementation are all referenced in the ERC-721 standard and recently the Su Squares source code [has been open sourced](./2021-08-29-open-source).

Shortly after finalization of the standard, Su Squares was shown on stage at the July 2018 Hong Kong NIFTY GG event. Su Squares achieved an "all passed" green score from the [ERC-721 validator](https://erc721validator.org/?address=0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F). The 0xcert reference implementation and the Codex protocol also achieved full compliance and every other known NFT project at the time (including CryptoKitties) did not actually comply with the ERC-721 standard. After some time, awareness and tooling have improved and in modern day nearly all NFT projects are ERC-721 compliant.

> Su Squares was the first ERC-721 digital collectable for sale.

## Timeline

* 2018-01-14 William's first on the [ERC-721 discussion thread](https://github.com/ethereum/eips/issues/721#issuecomment-357548185)

* 2018-01-24 First [draft of the ERC-841 standard](https://github.com/ethereum/EIPs/pull/841)

* 2018-01-31 tenthousandsu.com domain name registered

* 2018-03-01 [Initial public release](https://github.com/su-squares/ethereum-contract/commit/459009f643ea5cd7b322bbe51f964a4ebdc03de9) of the draft Su Squares smart contract, bug bounty started

* 2018-03-19 [First Ethereum Mainnet deployment](https://etherscan.io/tx/0x13d6eb301014d141edcd9826027a873c825d403438e9065116287ea43aa7da8d) of Su Squares, ⚠️ do not use old versions, they are insecure, following are some of the deployments found, there are many more

  * [Transaction 0x8db6...5374](https://etherscan.io/tx/0x8db60af69f40b07a9f439a20bf4838f16aeb645712029680012ea339c2c15374)
  * [Transaction 0xf453...6e3e](https://etherscan.io/tx/0xf4530da8db00d90b15c1158f797d22caa5a4b1b1e3ce9c56615ecf17d4266e3e)
  * [Transaction 0xda36...8c59](https://etherscan.io/tx/0xda360e16690d3b3eea4c9180540ccc99a7090ff26299b71705ea3729c1658c59)
  * [Transaction 0xecad...0054](https://etherscan.io/tx/0xecad62387037ff314b66e535aa6c1be0830d2b61a4fbdcbb280589b184890054), [ERC-721 Validator passed](https://erc721validator.org/?address=0x6731560e455537c9f088EA02A47a0ECFa28a9231)
  * [Transaction 0xe05b...e33a](https://etherscan.io/tx/0xe05b7f2f0796b98dad3bdba0a8998354caea9fcc3bb52b6127fb73de3636e33a), [ERC-721 Validator passed](https://erc721validator.org/?address=0xe264D16BCBA50925D0e1a90398596EC010306E14)
  * [Transaction 0x3d22...4946](https://etherscan.io/tx/0x3d22ffbb7fb13148062c94e4b1986e14b70d0981dbe71b40748b43c1f8274946), [ERC-721 Validator passed](https://erc721validator.org/?address=0x696c4dB4Dfb25b30a1C08f042e80172B2D34f4Bc)
  * [Transaction 0x07bb...cb1b](https://etherscan.io/tx/0x07bb215de77674c272b3a0e3f336642879f926df52e79d9ff8b26fdcbc4acb1b), [ERC-721 Validator passed](https://erc721validator.org/?address=0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F)

* 2018-03-19 First [commercial sale or grant](https://etherscan.io/tx/0xfb19b24a74ac540f3b13e27bb6a36f73bb1f3fc6e10d1cd671a0907d8d3ac04c) of a Square—every subsequent release of Su Squares maintained the ownership of this Square and other other Squares that were owned on superseded version of the contract

* 2018-06-21 ERC-721 was [promoted to final status](https://github.com/ethereum/EIPs/pull/1170) with congratulation from Dieter Shirley, the originator of ERC-721:

  > HUGE thanks to @fulldecent for running this down a very long field. Glad to see this getting finalized!

* 2018-07-24 [NIFTY Hong Kong](https://web.archive.org/web/20181226161553/https://www.nifty.gg/) kicks off, woah, just woah

* 2018-07-27 Ethereum Foundation approved a grant to support William Entriken in ERC-721 work, this was a private program (not DevGrants), [transaction](https://etherscan.io/tx/0x3f5342da9b079d5ced289c367e1829eaef016f3eca49e1b33479c64f1286facf). Privacy note: that sending address has already elsewhere been published as owned by Ethereum Foundation and was published by people publicly associated with Ethereum Foundation.

* 2018-08-05 Initial Deed Offering for Su Squares (i.e. first marketing push) https://x.com/fulldecent/status/1026316100378812416

* 2018-08-06 Received endorsement from NonFungibles.com https://x.com/nonfungibles/status/1026428522536075268

* 2018-08-14 Started our X account https://x.com/SuSquares/status/1029426483318738944

* 2018-11-05 Su Squares [was upgraded](https://etherscan.io/tx/0x07bb215de77674c272b3a0e3f336642879f926df52e79d9ff8b26fdcbc4acb1b), this is current version of the contract
* 2019-04-04 [First edition business cards ordered GotPrint order #238027xx](/assets/images/2019-04-04-business-cards-order.pdf), 35 pt. Trifecta Pearl with Kanvas Texture, quantity 250
* 2021-03-24 A commemorative one-of-one collectable of the original state of Su Squares is [minted on Rarible](https://rarible.com/token/0x60f80121c31a0d46b5279700f9df786054aa5ee5:580921?tab=details)

## Contemporaneous notes & interviews

These are some of the interview, notes and live events which mentioned Su Squares.

- 2018-07-24 [NIFTY Hong Kong](https://web.archive.org/web/20181226161553/https://www.nifty.gg/) presentation on stage shows Su Squares passing the validator test.
- 2018-11-13 John Gleeson. Farsight Podcast. "William Entriken – ERC-721 [Lead] Author and Su Squares Founder". https://web.archive.org/web/20200919050043/https://farsightpodcast.com/2018/11/19/william-entriken-erc-721-author-and-su-squares-founder/. (See also [Spotify episode](https://open.spotify.com/episode/3EWuR360XukbiCKAPW6Ah3))
- 2019-01-03 Karin Chang. CoinGecko Buzz. "William Entriken - The Catalyst Behind ERC-721". https://www.coingecko.com/buzz/spotlight-3-william-entriken
- 2019-04-28 罗鸿达. 金色财 (Jinse). "ERC721主作者：撰写协议的过程是对用例更加深入的探讨".   https://www.jinse.com/news/blockchain/357441.html.

More press coverage and speaking events may also be in the items listed at https://phor.net.

{% include jsonld/articles/project-history.html %}
