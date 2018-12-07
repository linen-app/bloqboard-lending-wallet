import { Injectable, Inject } from '@nestjs/common';
import { Contract, Wallet } from 'ethers';
import { TokenService } from './token.service';
import { TokenSymbol, Amount } from './types';

@Injectable()
export class CompoundService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        @Inject('money-market-contract') private readonly moneyMarketContract: Contract,
    ) { }

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
        const unlockTx = await this.tokenService.unlockToken(symbol, this.moneyMarketContract.address);
        const supplyTx = await this.moneyMarketContract.supply(
            token.address,
            rawAmount,
            { nonce: unlockTx.nonce + 1, gasLimit: 120000 },
        );

        if (needAwaitMining) {
            await unlockTx.wait();
            await supplyTx.wait();
        }

        return unlockTx.hash + '\n' + supplyTx.hash;
    }

    async withdraw(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.withdraw(token.address, rawAmount);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return txObject.hash;
    }

    async borrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject = await this.moneyMarketContract.borrow(token.address, rawAmount);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return txObject.hash;
    }

    async repayBorrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<string> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const unlockTx = await this.tokenService.unlockToken(symbol, this.moneyMarketContract.address);
        const repayTx = await this.moneyMarketContract.repayBorrow(
            token.address,
            rawAmount,
            { nonce: unlockTx.nonce + 1, gasLimit: 120000 },
        );

        if (needAwaitMining) {
            await unlockTx.wait();
            await repayTx.wait();
        }

        return unlockTx.hash + '\n' + repayTx.hash;
    }
}
