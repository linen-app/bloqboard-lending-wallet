import { Injectable, Inject } from '@nestjs/common';
import { ethers, Contract, Wallet, utils } from 'ethers';
import { TokenService } from './token.service';
import { TokenSymbol, Amount } from './types';
import * as Compound from '../resources/money-market.json';

@Injectable()
export class AppService {

    private readonly moneyMarketContract: Contract;

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
    ) {
        this.moneyMarketContract = new ethers.Contract(
            Compound.networks[4].address,
            Compound.abi,
            wallet,
        );
    }

    async getSupplyBalance(symbol: TokenSymbol): Promise<Amount> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res = await this.moneyMarketContract.getSupplyBalance(this.wallet.address, token.address);
        return res;
    }

    async getBorrowBalance(symbol: TokenSymbol): Promise<Amount> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res = await this.moneyMarketContract.getBorrowBalance(this.wallet.address, token.address);
        return res;
    }

    async getAccountLiquidity(): Promise<Amount> {
        const res = await this.moneyMarketContract.getAccountLiquidity(this.wallet.address);
        return res;
    }

    async supply(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.supply(token.address, rawAmount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async withdraw(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.withdraw(token.address, rawAmount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async borrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.borrow(token.address, rawAmount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async repayBorrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.repayBorrow(token.address, rawAmount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }
}
