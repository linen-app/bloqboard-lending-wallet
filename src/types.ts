import { BigNumber } from 'ethers/utils';
import { ContractTransaction } from 'ethers';

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

export interface TransactionLogResponse {
    transactions: {
        name: string;
        transactionObject: ContractTransaction
    }[];
}