---
layout: article
permalink: /articles/2018-09-18-operator-bug
title: Operator bug
image: "{{ site.baseurl }}/assets/images/su-OG.png"
description: "Recounts the OpenSea discovery of an operator bug and its security impact on Su Squares."
---

# OpenSea identifies operator bug with Su Squares

***OpenSea employee Devin Finzer identified a error with the Su Squares implementation**, announced in the [OpenSea Discord](https://discord.gg/ga8EJbv) #general channel on Tuesday at 2018-09-18 at 22:57 UTC.*

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

## What is the bug?

The bug is an error in the smart contract for Su Squares related to the operator feature.

The operator feature allows you to authorize somebody to have access to all your squares. This is useful for auction sites, which may transfer several of your squares at a time. And sure enough, employee Devin Finzer at OpenSea is the one that identified the issue. Details are posted on [our GitHub repository](https://github.com/fulldecent/su-squares-bounty/issues/10).

One impact of the bug is that transfers will not process as intended if you use the operator feature for your squares.

## What is the security implication?

Many bugs also have security implications and this one is no exception. A different way of interpreting this same bug allows people to steal other people's squares. Details on how to do this will be released in the future. But first we will identify if any other projects (unrelated to Su Squares) are affected so that we can make a responsible disclosure to them.

## Will you fix it?

Yes, we are working now to document and resolve the problem. The new version will publish within one week and will be live on the https://tenthousandsu.com/ homepage. A second announcement will be made on [@SuSquares](https://x.com/SuSquares) on X and also on this site.

## What happens to my squares?

Your squares will be accessible again once the new smart contract is deployed. The squares will be accessible to owners of the squares at the time of this announcement. In the meantime, the existing personalizations will be shown on the [homepage](https://tenthousandsu.com/).
