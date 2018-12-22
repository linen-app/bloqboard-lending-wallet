import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ethers, utils } from 'ethers';
import { TokenService } from '../tokens/TokenService';
import { TokenSymbol, Amount, TokenMetadata } from '../types';
import { TransactionLog } from '../TransactionLog';

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
        rawAmount: Amount,
        tokenSymbolToSell: TokenSymbol,
        tokenSymbolToBuy: TokenSymbol,
        needAwaitMining: boolean,
        nonce?: number,
    ): Promise<TransactionLog> {
        const tokenToBuy = this.tokenService.getTokenBySymbol(tokenSymbolToBuy);
        const tokenToSell = this.tokenService.getTokenBySymbol(tokenSymbolToSell);
        const transactions = new TransactionLog();

        await this.tokenService.addUnlockTransactionIfNeeded(tokenSymbolToSell, this.kyberContract.address, transactions);

        const { slippageRate } = await this.kyberContract.getExpectedRate(tokenToSell.address, tokenToBuy.address, rawAmount);

        const tradeTx = await this.kyberContract.swapTokenToToken(
            tokenToSell.address,
            rawAmount,
            tokenToBuy.address,
            slippageRate,
            { nonce: transactions.getNextNonce() },
        );

        transactions.add({
            name: 'tradeTx',
            transactionObject: tradeTx,
        });

        this.logger.info(`Selling ${rawAmount} ${tokenSymbolToSell} for ${tokenSymbolToBuy}`);

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    async buyToken(
        rawAmount: Amount,
        tokenSymbolToBuy: TokenSymbol,
        tokenSymbolToSell: TokenSymbol,
        needAwaitMining: boolean,
        nonce?: number,
    ): Promise<TransactionLog> {
        const tokenToBuy = this.tokenService.getTokenBySymbol(tokenSymbolToBuy);
        const tokenToSell = this.tokenService.getTokenBySymbol(tokenSymbolToSell);
        const transactions = new TransactionLog();

        await this.tokenService.addUnlockTransactionIfNeeded(tokenSymbolToSell, this.kyberContract.address, transactions);

        const approximateAmountToSell = await this.calcApproximateAmountToSell(rawAmount, tokenToBuy, tokenToSell);
        const { amountToSell, rate } = await this.calcAmountToSell(rawAmount, approximateAmountToSell, tokenToBuy, tokenToSell);

        const tradeTx = await this.kyberContract.trade(
            tokenToSell.address,
            amountToSell,
            tokenToBuy.address,
            this.wallet.address,
            rawAmount,
            rate,
            ethers.constants.AddressZero,
            { nonce: transactions.getNextNonce() },
        );

        transactions.add({
            name: 'tradeTx',
            transactionObject: tradeTx,
        });

        this.logger.info(`Buying ${rawAmount} ${tokenSymbolToBuy} for ${tokenSymbolToSell}`);

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    private async calcApproximateAmountToSell(
        rawAmountToBuy: Amount,
        tokenToBuy: TokenMetadata,
        tokenToSell: TokenMetadata,
    ) {
        const response = await this.kyberContract.getExpectedRate(tokenToBuy.address, tokenToSell.address, rawAmountToBuy);
        const amountToSell = rawAmountToBuy.mul(response.slippageRate).div(PRECISION);
        this.logger.info(`calcApproximateAmountToSell rate: ${utils.formatEther(response.slippageRate)}`);
        this.logger.info(`calcApproximateAmountToSell: ${utils.formatEther(amountToSell)}`);

        return amountToSell;
    }

    private async calcAmountToSell(
        amountToBuy: Amount,
        approximateAmountToSell: Amount,
        tokenToBuy: TokenMetadata,
        tokenToSell: TokenMetadata,
    ) {
        const response = await this.kyberContract.getExpectedRate(tokenToSell.address, tokenToBuy.address, approximateAmountToSell);
        const amountToSell = amountToBuy.mul(PRECISION).div(response.slippageRate);
        this.logger.info(`calcAmountToSell rate: ${utils.formatEther(response.slippageRate)}`);
        this.logger.info(`calcAmountToSell: ${utils.formatEther(amountToSell)}`);

        return { amountToSell, rate: response.slippageRate };
    }
}