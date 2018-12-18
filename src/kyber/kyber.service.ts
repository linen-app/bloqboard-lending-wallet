import { Injectable, Inject } from '@nestjs/common';
import { Contract, Wallet, ContractTransaction, ethers, utils } from 'ethers';
import { TokenService } from '../token.service';
import { TokenSymbol, Amount, TransactionLogResponse, TokenMetadata } from '../types';

const PRECISION = ethers.constants.WeiPerEther;

@Injectable()
export class KyberService {
    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        @Inject('kyber-contract') private readonly kyberContract: Contract,
    ) { }

    async buyToken(
        rawAmount: Amount,
        tokenSymbolToBuy: TokenSymbol,
        tokenSymbolToSell: TokenSymbol,
        needAwaitMining: boolean,
    ): Promise<TransactionLogResponse> {
        const tokenToBuy = this.tokenService.getTokenBySymbol(tokenSymbolToBuy);
        const tokenToSell = this.tokenService.getTokenBySymbol(tokenSymbolToSell);
        let unlockTx: ContractTransaction = null;

        if (await this.tokenService.isTokenLockedForSpender(tokenSymbolToSell, this.kyberContract.address)) {
            unlockTx = await this.tokenService.unlockToken(tokenSymbolToSell, this.kyberContract.address);
        }

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
            { nonce: unlockTx && unlockTx.nonce + 1 },
        );

        if (needAwaitMining) {
            if (unlockTx) await unlockTx.wait();
            await tradeTx.wait();
        }

        const result = {
            transactions: [{
                name: 'tradeTx',
                transactionObject: tradeTx,
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

    private async calcApproximateAmountToSell(
        rawAmountToBuy: Amount,
        tokenToBuy: TokenMetadata,
        tokenToSell: TokenMetadata,
    ) {
        const response = await this.kyberContract.getExpectedRate(tokenToBuy.address, tokenToSell.address, rawAmountToBuy);
        const amountToSell = rawAmountToBuy.mul(response.slippageRate).div(PRECISION);
        console.log('calcApproximateAmountToSell:rate', utils.formatEther(response.slippageRate));
        console.log('calcApproximateAmountToSell', utils.formatEther(amountToSell));

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
        console.log('calcAmountToSell:rate', utils.formatEther(response.slippageRate));
        console.log('calcAmountToSell', utils.formatEther(amountToSell));

        return { amountToSell, rate: response.slippageRate };
    }
}