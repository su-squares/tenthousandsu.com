export type MockRpcOwnerOverride = {
  squareId: number;
  owner: string;
};

export type MockRpcOptions = {
  chainId: number;
  salePriceWei?: string;
  personalizePriceWei?: string;
  failDuplicatePurchase?: boolean;
  ownerAddress?: string;
  ownerOverrides?: MockRpcOwnerOverride[];
  ownedSquares?: number[];
};
