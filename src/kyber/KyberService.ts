import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ethers, utils } from 'ethers';
import { TokenService } from '../tokens/TokenService';
import { TransactionLog } from '../common-models/TransactionLog';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenAmount } from '../tokens/TokenAmount';
import { BigNumber } from 'ethers/utils';

const PRECISION = ethers.constants.WeiPerEther;

@Injectable()
export class KyberService {
    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        @Inject('winston') private readonly logger: Logger,
        @Inject('kyber-contract') private readonly kyberContract: Contract,
    ) { }

    async sellToken(
        humanReadableAmount: number,
        tokenSymbolToSell: TokenSymbol,
        tokenSymbolToBuy: TokenSymbol,
        needAwaitMining: boolean,
        nonce?: number,
    ): Promise<TransactionLog> {
        const tokenToBuy = this.tokenService.getTokenBySymbol(tokenSymbolToBuy);
        const amountToSell = TokenAmount.fromHumanReadable(
            humanReadableAmount,
            this.tokenService.getTokenBySymbol(tokenSymbolToSell),
        );
        const transactions = new TransactionLog();

        await this.tokenService.assertTokenBalance(amountToSell);
        await this.tokenService.addUnlockTransactionIfNeeded(tokenSymbolToSell, this.kyberContract.address, transactions);

        const { slippageRate } = await this.kyberContract.getExpectedRate(amountToSell.token.address, tokenToBuy.address, amountToSell.rawAmount);

        const tradeTx = await this.kyberContract.swapTokenToToken(
            amountToSell.token.address,
            amountToSell.rawAmount,
            tokenToBuy.address,
            slippageRate,
            { nonce: transactions.getNextNonce(), gasLimit: 450000 },
        );

        transactions.add({
            name: 'tradeTx',
            transactionObject: tradeTx,
        });

        this.logger.info(`Selling ${amountToSell} for ${tokenSymbolToBuy}`);

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    buyToken(
        humanReadableAmount: number,
        tokenSymbolToBuy: TokenSymbol,
        tokenSymbolToSell: TokenSymbol,
        needAwaitMining: boolean,
    ): Promise<TransactionLog> {
        const amountToBuy = TokenAmount.fromHumanReadable(
            humanReadableAmount,
            this.tokenService.getTokenBySymbol(tokenSymbolToBuy),
        );

        return this.buyTokenRawAmount(
            amountToBuy,
            tokenSymbolToSell,
            needAwaitMining,
        );
    }

    async buyTokenRawAmount(
        amountToBuy: TokenAmount,
        tokenSymbolToSell: TokenSymbol,
        needAwaitMining: boolean,
        transactions: TransactionLog = new TransactionLog(),
    ): Promise<TransactionLog> {
        const tokenToSell = this.tokenService.getTokenBySymbol(tokenSymbolToSell);
        const approximateAmountToSell = await this.calcApproximateAmountToSell(amountToBuy, tokenToSell);
        const { amountToSell, rate } = await this.calcAmountToSell(amountToBuy, approximateAmountToSell);

        await this.tokenService.assertTokenBalance(amountToSell);
        await this.tokenService.addUnlockTransactionIfNeeded(tokenSymbolToSell, this.kyberContract.address, transactions);

        const tradeTx = await this.kyberContract.trade(
            tokenToSell.address,
            amountToSell.rawAmount,
            amountToBuy.token.address,
            this.wallet.address,
            amountToBuy.rawAmount,
            rate,
            ethers.constants.AddressZero,
            { nonce: transactions.getNextNonce(), gasLimit: 450000 },
        );

        transactions.add({
            name: 'tradeTx',
            transactionObject: tradeTx,
        });

        this.logger.info(`Buying ${amountToBuy} for ${tokenSymbolToSell}`);

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    async getSlippageRate(amountToSellHumanReadable: number, symbolToSell: TokenSymbol, symbolToBuy: TokenSymbol): Promise<number> {
        const tokenToSell = this.tokenService.getTokenBySymbol(symbolToSell);
        const tokenToBuy = this.tokenService.getTokenBySymbol(symbolToBuy);
        const amountToSell = TokenAmount.fromHumanReadable(amountToSellHumanReadable, tokenToSell);

        const response = await this.kyberContract.getExpectedRate(
            amountToSell.token.address,
            tokenToBuy.address,
            amountToSell.rawAmount,
        );
        const rate: BigNumber = response.slippageRate;
        const formattedRate = Number.parseFloat(utils.formatEther(rate));
        return formattedRate;
    }

    async ensureEnoughBalance(neededBalance: TokenAmount, transactions: TransactionLog): Promise<void> {
        const balance = await this.tokenService.getTokenBalance(neededBalance.token.symbol);

        if (neededBalance.rawAmount.gt(balance.rawAmount)) {
            let additionalTokenAmount = neededBalance.rawAmount.sub(balance.rawAmount);
            const smallAddition = additionalTokenAmount.div(1000);
            additionalTokenAmount = additionalTokenAmount.add(smallAddition);
            const additionalAmount = new TokenAmount(additionalTokenAmount, neededBalance.token);

            this.logger.info(`Buying additional: ${additionalAmount}`);

            const kyberTxs = await this.buyTokenRawAmount(
                additionalAmount,
                TokenSymbol.WETH,
                false,
                transactions,
            );
            transactions.combine(kyberTxs);
        }
    }

    private async calcApproximateAmountToSell(
        amountToBuy: TokenAmount,
        tokenToSell: TokenMetadata,
    ): Promise<TokenAmount> {
        const response = await this.kyberContract.getExpectedRate(amountToBuy.token.address, tokenToSell.address, amountToBuy.rawAmount);
        const amountToSell = amountToBuy.rawAmount.mul(response.slippageRate).div(PRECISION);
        this.logger.info(`calcApproximateAmountToSell rate: ${utils.formatEther(response.slippageRate)}`);
        this.logger.info(`calcApproximateAmountToSell: ${utils.formatEther(amountToSell)}`);

        return new TokenAmount(amountToSell, tokenToSell);
    }

    private async calcAmountToSell(
        amountToBuy: TokenAmount,
        approximateAmountToSell: TokenAmount,
    ) {
        const response = await this.kyberContract.getExpectedRate(
            approximateAmountToSell.token.address,
            amountToBuy.token.address,
            approximateAmountToSell.rawAmount,
        );
        const amountToSell = amountToBuy.rawAmount.mul(PRECISION).div(response.slippageRate);
        this.logger.info(`calcAmountToSell rate: ${utils.formatEther(response.slippageRate)}`);
        this.logger.info(`calcAmountToSell: ${utils.formatEther(amountToSell)}`);

        return {
            amountToSell: new TokenAmount(amountToSell, approximateAmountToSell.token),
            rate: response.slippageRate,
        };
    }
}