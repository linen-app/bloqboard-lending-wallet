import { BigNumber } from 'ethers/utils';

export enum TokenSymbol {
    ZRX = 'ZRX',
    BAT = 'BAT',
    REP = 'REP',
    DAI = 'DAI',
    WETH = 'WETH',
}

export class TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
}

export type Address = string;

export type Amount = BigNumber;