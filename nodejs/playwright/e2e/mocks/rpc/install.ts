import type { Page } from '@playwright/test';
import {
  DEFAULT_PERSONALIZE_PRICE_WEI,
  DEFAULT_SALE_PRICE_WEI,
  BALANCE_OF_SIG,
  ENS_REVERSE_SIG,
  MULTICALL_AGGREGATE3_SIG,
  OWNER_OF_SIG,
  PERSONALIZE_PRICE_SIG,
  PURCHASE_SIGS,
  SALE_PRICE_SIG,
  TOKEN_OF_OWNER_BY_INDEX_SIG,
} from './constants.js';
import type { MockRpcOptions } from './types.js';
import { mockRpcInitScript } from './init-script.js';

export async function installMockRpc(page: Page, options: MockRpcOptions) {
  const config = {
    chainId: options.chainId,
    salePriceWei: options.salePriceWei || DEFAULT_SALE_PRICE_WEI,
    personalizePriceWei: options.personalizePriceWei || DEFAULT_PERSONALIZE_PRICE_WEI,
    failDuplicatePurchase: options.failDuplicatePurchase !== false,
    salePriceSig: SALE_PRICE_SIG,
    personalizePriceSig: PERSONALIZE_PRICE_SIG,
    ownerOfSig: OWNER_OF_SIG,
    balanceOfSig: BALANCE_OF_SIG,
    tokenOfOwnerByIndexSig: TOKEN_OF_OWNER_BY_INDEX_SIG,
    ensReverseSig: ENS_REVERSE_SIG,
    multicallAggregate3Sig: MULTICALL_AGGREGATE3_SIG,
    purchaseSigs: PURCHASE_SIGS,
    ownerAddress: options.ownerAddress,
    ownerOverrides: options.ownerOverrides,
    ownedSquares: options.ownedSquares,
  };

  await page.addInitScript(mockRpcInitScript, config);
}
