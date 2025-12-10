---
layout: article
permalink: /articles/2018-11-11-operator-bug-fixed
title: Operator bug fixed
image: "{{ site.baseurl }}/assets/images/su-OG.png"
description: "Announces the relaunch after the operator bug fix and shares lessons learned for ERC-721 security."
---

# Su Squares relaunches with fix for operator bug

***After [a minor fix](https://github.com/su-squares/ethereum-contract/commit/30f305710706371326486ef14daf941c0276a9c5) and much due diligence, Su Squares is back online.** Best practices and lessons learned and reviewed here.*

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

## What was the bug?

A simple bug in the previous Su Squares smart contract caused the ERC-721 transfer mechanism to work incorrectly when using delegated access (an "operator"). This was first recognized by Devin Finzer, read more in our [original announcement](/articles/2018-09-18-operator-bug).

Very often, bugs (behaviors not working as expected) in computer programs can be used in creative ways to exploit the security of a system. This bug falls in that category. With this bug it is possible to assign yourself as an operator (which is not a problem) and then steal other people's squares (which IS a problem).

## How was it fixed?

The fix required correcting the permissions check for operators. This is detailed in full in [a GitHub commit](https://github.com/su-squares/ethereum-contract/commit/30f305710706371326486ef14daf941c0276a9c5).

In addition to this succinct security fix, [a complete test suite](https://github.com/su-squares/ethereum-contract/compare/1.0...2.0) was added to the GitHub repository.

## Does this impact other projects?

Su Squares includes code written by William Entriken. William works as an advisor for other related blockchain projects and [provides classes on blockchain and tokens](https://chain76.org), also he is an author of the ERC-721 standard. Therefore, responsible disclosure of this bug must take into account Su Square customers as well as the non-fungibles and blockchain community as a whole.

Before publishing this announcement, we have worked at length to review other implementations of ERC-721 to find if any of them copied the erroneous code from Su Squares and are themselves vulnerable to this security issue. The scope of this search included only Ethereum Mainnet. We have not found any other project that is vulnerable. Therefore we expect this announcement has no collateral damage on the community.

## Lessons learned and best practices

First, of course, always review your code with a third party. And making the source code for a blockchain project public is almost always necessary.

Have a bug bounty. If your project is selling to the public, or if your reputation is at risk from a bug in your code, then you should offer valuable consideration to people that would bring errors to your attention. Keep your bug bounty active after you launch!

Have test cases. Remember [TPS reports from Office Space](https://www.youtube.com/watch?v=Fy3rjQGc6lA)? Those are testing procedure specifications, and it is a best practice to document specific ways of testing your computer program.

Su Squares had implemented all these best practices: peer review; multiple well-advertised bug bounties; test scenarios on Ropsten. So what could have stopped this bug?

Automated testing. This allows scripted test processes to be run by a computer rather than relying on a human to complete the process. The benefit is that tests can be run more often and features that work today can be tested again before shipping in case something may have changed.

Automated testing in blockchain projects could be better. We started by using the [testing tools built into Remix IDE](https://github.com/ethereum/remix/tree/master/remix-tests). We opened issues and contributed fixes and wish that the project will continue to make improvements. Next we reviewed Truffle, many people use Truffle without understanding the boilerplate setup required. We opened an issue and did the best we could to make our test setup readable. Then we imported tests from [0xcert's ERC-721 implementation](https://github.com/0xcert/ethereum-erc721) and added our own.

Now we have a higher degree of confidence in the Su Squares smart contract and it should be easier for third parties to audit.

Thank you for your extreme patience during this update, and we sincerely apologize for the inconvenience this caused you.

Stay tuned for an upcoming announcement about our re-launch event. [See our X](https://x.com/susquares). And happy singles day!

{% include jsonld/articles/operator-bug-fixed.html %}
