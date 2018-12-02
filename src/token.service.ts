import { Injectable, Inject } from '@nestjs/common';
import * as ERC20 from '../resources/erc20.json';
import { Wallet, Contract, utils, ContractTransaction } from 'ethers';
import { TokenSymbol, TokenMetadata, Amount, Address } from './types';

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

    fromHumanReadable(amount: string, symbol: TokenSymbol): Amount{
        const token = this.getTokenBySymbol(symbol);
        return utils.parseUnits(amount, token.decimals);
    }

    toHumanReadable(rawAmount: Amount, symbol: TokenSymbol): string{
        const token = this.getTokenBySymbol(symbol);
        return utils.formatUnits(rawAmount, token.decimals);
    }

    async getTokenBalance(symbol: TokenSymbol): Promise<Amount> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const balance = await contract.balanceOf(this.wallet.address);
        return balance;
    }

    async getAllowance(symbol: TokenSymbol, spender: Address): Promise<Amount> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const allowance = await contract.allowance(this.wallet.address, spender);
        return allowance;
    }

    async unlockToken(symbol: TokenSymbol, spender: Address): Promise<ContractTransaction> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const maxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const tx: ContractTransaction = await contract.approve(spender, maxUint256);

        return tx;
    }
}