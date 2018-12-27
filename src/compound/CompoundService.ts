import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ContractTransaction, ethers } from 'ethers';
import { TokenService } from '../tokens/TokenService';
import { TransactionLog } from '../common-models/TransactionLog';
import { KyberService } from '../kyber/KyberService';
import { BigNumber } from 'ethers/utils';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenAmount } from '../tokens/TokenAmount';

@Injectable()
export class CompoundService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        private readonly kyberService: KyberService,
        @Inject('winston') private readonly logger: Logger,
        @Inject('money-market-contract') private readonly moneyMarketContract: Contract,
    ) { }

    async getSupplyBalance(symbol: TokenSymbol): Promise<TokenAmount> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res: BigNumber = await this.moneyMarketContract.getSupplyBalance(this.wallet.address, token.address);
        return new TokenAmount(res, token);
    }

    async getBorrowBalance(symbol: TokenSymbol): Promise<TokenAmount> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const res: BigNumber = await this.moneyMarketContract.getBorrowBalance(this.wallet.address, token.address);
        return new TokenAmount(res, token);
    }

    async getAccountLiquidity(): Promise<BigNumber> {
        const res: BigNumber = await this.moneyMarketContract.getAccountLiquidity(this.wallet.address);
        return res;
    }

    async supply(symbol: TokenSymbol, humanReadableTokenAmount: number, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const tokenAmount = TokenAmount.fromHumanReadable(humanReadableTokenAmount, token);
        const transactions = new TransactionLog();

        await this.tokenService.assertTokenBalance(tokenAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(symbol, this.moneyMarketContract.address, transactions);

        const supplyTx: ContractTransaction = await this.moneyMarketContract.supply(
            token.address,
            tokenAmount.rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 300000 },
        );

        this.logger.info(`Supplying ${tokenAmount}`);

        transactions.add({
            name: 'supply',
            transactionObject: supplyTx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }
        return transactions;
    }

    async withdraw(symbol: TokenSymbol, humanReadableTokenAmount: number, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const tokenAmount = TokenAmount.fromHumanReadable(humanReadableTokenAmount, token);
        const txObject: ContractTransaction = await this.moneyMarketContract.withdraw(token.address, tokenAmount.rawAmount);

        this.logger.info(`Withdrawing ${tokenAmount}`);

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

    async borrow(symbol: TokenSymbol, humanReadableTokenAmount: number, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(symbol);
        const tokenAmount = TokenAmount.fromHumanReadable(humanReadableTokenAmount, token);
        const txObject: ContractTransaction = await this.moneyMarketContract.borrow(token.address, tokenAmount.rawAmount);

        this.logger.info(`Borrowing ${tokenAmount}`);

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
        humanReadableTokenAmount: number,
        utilizeOtherTokens: boolean,
        needAwaitMining: boolean,
    ): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const token = this.tokenService.getTokenBySymbol(symbol);
        const tokenAmount = TokenAmount.fromHumanReadable(humanReadableTokenAmount, token);

        await this.tokenService.assertTokenBalance(tokenAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(symbol, this.moneyMarketContract.address, transactions);

        const neededTokenAmount = tokenAmount.rawAmount.eq(ethers.constants.MaxUint256) ?
            (await this.getBorrowBalance(symbol)).rawAmount :
            tokenAmount.rawAmount;

        const balance = await this.tokenService.getTokenBalance(symbol);
        this.logger.info(`utilizeOtherTokens: ${utilizeOtherTokens}`);
        if (neededTokenAmount.gt(balance.rawAmount) && utilizeOtherTokens) {
            let additionalTokenAmount = neededTokenAmount.sub(balance.rawAmount);
            const smallAddition = additionalTokenAmount.div(1000);
            additionalTokenAmount = additionalTokenAmount.add(smallAddition);
            this.logger.info(`buying additional TokenAmount: ${additionalTokenAmount.toString()}`);
            const kyberTxs = await this.kyberService.buyTokenRawAmount(
                new TokenAmount(additionalTokenAmount, tokenAmount.token),
                TokenSymbol.WETH,
                false,
                transactions.getNextNonce(),
            );
            transactions.combine(kyberTxs);
        }

        const repayTx: ContractTransaction = await this.moneyMarketContract.repayBorrow(
            token.address,
            tokenAmount.rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 300000 },
        );

        this.logger.info(`Repaying ${tokenAmount.rawAmount.eq(ethers.constants.MaxUint256) ? 'ALL ' + symbol : tokenAmount}`);

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
