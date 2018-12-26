import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ethers, utils } from 'ethers';
import { TokenService } from '../tokens/TokenService';
import { TransactionLog } from '../TransactionLog';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenAmount } from '../tokens/TokenAmount';

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
        nonce?: number,
    ): Promise<TransactionLog> {
        const amountToBuy = TokenAmount.fromHumanReadable(
            humanReadableAmount,
            this.tokenService.getTokenBySymbol(tokenSymbolToBuy),
        );

        return this.buyTokenRawAmount(
            amountToBuy,
            tokenSymbolToSell,
            needAwaitMining,
            nonce,
        );
    }

    async buyTokenRawAmount(
        amountToBuy: TokenAmount,
        tokenSymbolToSell: TokenSymbol,
        needAwaitMining: boolean,
        nonce?: number,
    ): Promise<TransactionLog> {
        const tokenToSell = this.tokenService.getTokenBySymbol(tokenSymbolToSell);

        const transactions = new TransactionLog();

        await this.tokenService.addUnlockTransactionIfNeeded(tokenSymbolToSell, this.kyberContract.address, transactions, nonce);

        const approximateAmountToSell = await this.calcApproximateAmountToSell(amountToBuy, tokenToSell);
        const { amountToSell, rate } = await this.calcAmountToSell(amountToBuy, approximateAmountToSell);

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