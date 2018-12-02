import { Injectable, Inject } from '@nestjs/common';
import * as ERC20 from '../resources/erc20.json';
import { Wallet, Contract, utils } from 'ethers';
import { TokenSymbol, TokenMetadata } from './token.entity';

@Injectable()
export class TokenService {

    constructor(
        @Inject('tokens') private readonly tokens: TokenMetadata[],
        @Inject('wallet') private readonly wallet: Wallet,
    ) { }

    getTokenBySymbol(symbol: TokenSymbol): TokenMetadata {
        return this.tokens.find(x => x.symbol === symbol);
    }

    getTokenSymbols(): TokenSymbol[] {
        return this.tokens.map(x => (x.symbol as TokenSymbol));
    }

    async getTokenBalance(symbol: TokenSymbol): Promise<string> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const balance = await contract.balanceOf(this.wallet.address);
        return utils.formatUnits(balance, token.decimals);
    }
}