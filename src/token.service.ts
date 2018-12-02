import { Injectable, Inject } from '@nestjs/common';

class TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
}

@Injectable()
export class TokenService {
    constructor(@Inject('tokens') private readonly tokens: TokenMetadata[]) { }

    getTokenBySymbol(symbol: string) {
        const res = this.tokens.find(x => x.symbol === symbol);
        return res;
    }
}