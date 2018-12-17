import { Injectable, Inject } from '@nestjs/common';
import { Contract, Wallet, ContractTransaction } from 'ethers';
import { TokenService } from './token.service';
import { TokenSymbol, Amount, TransactionLogResponse } from './types';

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

    async supply(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLogResponse> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        let unlockTx: ContractTransaction = null;

        if (await this.tokenService.isTokenLockedForSpender(symbol, this.moneyMarketContract.address)) {
            unlockTx = await this.tokenService.unlockToken(symbol, this.moneyMarketContract.address);
        }

        const supplyTx: ContractTransaction = await this.moneyMarketContract.supply(
            token.address,
            rawAmount,
            { nonce: unlockTx && unlockTx.nonce + 1, gasLimit: 300000 },
        );

        if (needAwaitMining) {
            if (unlockTx) await unlockTx.wait();
            await supplyTx.wait();
        }

        const result = {
            transactions: [{
                name: 'supply',
                transactionObject: supplyTx,
            }],
        };

        if (unlockTx) {
            result.transactions.push({
                name: 'unlock',
                transactionObject: unlockTx,
            });
        }

        return result;
    }

    async withdraw(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLogResponse> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject: ContractTransaction = await this.moneyMarketContract.withdraw(token.address, rawAmount);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return {
            transactions: [{
                name: 'withdraw',
                transactionObject: txObject,
            }],
        };
    }

    async borrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLogResponse> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject: ContractTransaction = await this.moneyMarketContract.borrow(token.address, rawAmount);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return {
            transactions: [{
                name: 'borrow',
                transactionObject: txObject,
            }],
        };
    }

    async repayBorrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLogResponse> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        let unlockTx: ContractTransaction = null;

        if (await this.tokenService.isTokenLockedForSpender(symbol, this.moneyMarketContract.address)) {
            unlockTx = await this.tokenService.unlockToken(symbol, this.moneyMarketContract.address);
        }

        const repayTx: ContractTransaction = await this.moneyMarketContract.repayBorrow(
            token.address,
            rawAmount,
            { nonce: unlockTx && unlockTx.nonce + 1, gasLimit: 300000 },
        );

        if (needAwaitMining) {
            if (unlockTx) await unlockTx.wait();
            await repayTx.wait();
        }

        const result = {
            transactions: [{
                name: 'repayBorrow',
                transactionObject: repayTx,
            }],
        };

        if (unlockTx) {
            result.transactions.push({
                name: 'unlock',
                transactionObject: unlockTx,
            });
        }

        return result;
    }
}
