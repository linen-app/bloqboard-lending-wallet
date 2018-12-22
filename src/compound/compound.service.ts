import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ContractTransaction, ethers } from 'ethers';
import { TokenService } from '../token.service';
import { TokenSymbol, Amount } from '../types';
import { TransactionLog } from '../TransactionLog';
import { KyberService } from '../kyber/kyber.service';

@Injectable()
export class CompoundService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        private readonly kyberService: KyberService,
        @Inject('winston') private readonly logger: Logger,
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

    async supply(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const transactions = new TransactionLog();

        await this.tokenService.addUnlockTransactionIfNeeded(symbol, this.moneyMarketContract.address, transactions);

        const supplyTx: ContractTransaction = await this.moneyMarketContract.supply(
            token.address,
            rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 300000 },
        );

        this.logger.info(`Supplying ${rawAmount.toString()} ${symbol}`);

        transactions.add({
            name: 'supply',
            transactionObject: supplyTx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }
        return transactions;
    }

    async withdraw(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject: ContractTransaction = await this.moneyMarketContract.withdraw(token.address, rawAmount);

        this.logger.info(`Withdrawing ${rawAmount.toString()} ${symbol}`);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return new TransactionLog(
            [{
                name: 'withdraw',
                transactionObject: txObject,
            }],
        );
    }

    async borrow(symbol: TokenSymbol, rawAmount: Amount, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const txObject: ContractTransaction = await this.moneyMarketContract.borrow(token.address, rawAmount);

        this.logger.info(`Borrowing ${rawAmount.toString()} ${symbol}`);

        if (needAwaitMining) {
            await txObject.wait();
        }

        return new TransactionLog(
            [{
                name: 'borrow',
                transactionObject: txObject,
            }],
        );
    }

    async repayBorrow(
        symbol: TokenSymbol,
        rawAmount: Amount,
        utilizeOtherTokens: boolean,
        needAwaitMining: boolean,
    ): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const token = this.tokenService.getTokenBySymbol(symbol);

        await this.tokenService.addUnlockTransactionIfNeeded(symbol, this.moneyMarketContract.address, transactions);

        const neededAmount = rawAmount.eq(ethers.constants.MaxUint256) ? (await this.getBorrowBalance(symbol)) : rawAmount;
        const balance = await this.tokenService.getTokenBalance(symbol);
        this.logger.info(`utilizeOtherTokens: ${utilizeOtherTokens}`);
        if (neededAmount.gt(balance) && utilizeOtherTokens) {
            const additionalAmount = neededAmount.sub(balance);
            this.logger.info(`buying additional amount: ${additionalAmount.toString()}`);
            const kyberTxs = await this.kyberService.buyToken(
                additionalAmount,
                symbol,
                TokenSymbol.WETH,
                false,
                transactions.getNextNonce(),
            );
            transactions.combine(kyberTxs);
        }

        const repayTx: ContractTransaction = await this.moneyMarketContract.repayBorrow(
            token.address,
            rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 300000 },
        );

        this.logger.info(`Repaying ${rawAmount.eq(ethers.constants.MaxUint256) ? 'ALL' : rawAmount.toString()} ${symbol}`);

        transactions.add({
            name: 'repayBorrow',
            transactionObject: repayTx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }
}
