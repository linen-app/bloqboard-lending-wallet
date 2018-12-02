import { Injectable, Inject } from '@nestjs/common';
import { ethers, Contract, Wallet, utils } from 'ethers';
import { TokenService } from './token.service';
import { TokenSymbol } from './token.entity';
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

    async getSupplyBalance(symbol: TokenSymbol): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res = await this.moneyMarketContract.getSupplyBalance(this.wallet.address, token.address);
        return utils.formatUnits(res, token.decimals);
    }

    async getBorrowBalance(symbol: TokenSymbol): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res = await this.moneyMarketContract.getBorrowBalance(this.wallet.address, token.address);
        return utils.formatUnits(res, token.decimals);
    }

    async getAccountLiquidity(): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);
        const res = await this.moneyMarketContract.getAccountLiquidity(this.wallet.address);
        return utils.formatUnits(res, token.decimals);
    }

    async supply(symbol: TokenSymbol, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const amount = utils.parseUnits(rawAmount, token.decimals);
        const txObject = await this.moneyMarketContract.supply(token.address, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async withdraw(symbol: TokenSymbol, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const amount = utils.parseUnits(rawAmount, token.decimals);
        const txObject = await this.moneyMarketContract.withdraw(token.address, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async borrow(symbol: TokenSymbol, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const amount = utils.parseUnits(rawAmount, token.decimals);
        const txObject = await this.moneyMarketContract.borrow(token.address, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async repayBorrow(symbol: TokenSymbol, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const amount = utils.parseUnits(rawAmount, token.decimals);
        const txObject = await this.moneyMarketContract.repayBorrow(token.address, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }
}
