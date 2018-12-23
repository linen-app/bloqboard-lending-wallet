import { Address } from 'src/types';
import { TokenSymbol } from './TokenSymbol';
export class TokenMetadata {
    address: Address;
    symbol: TokenSymbol;
    name: string;
    decimals: number;
}
