import { Injectable, Inject } from '@nestjs/common';
import { Contract, Wallet, ContractTransaction, ethers } from 'ethers';
import { TokenService } from '../token.service';
import { TokenSymbol, Amount, TransactionLogResponse } from '../types';

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

        const response = await this.kyberContract.getExpectedRate(tokenToSell.address, tokenToBuy.address, 1);
        const percision = ethers.constants.WeiPerEther;
        const amountToSell = rawAmount.mul(percision).div(response.slippageRate);

        const tradeTx = await this.kyberContract.trade(
            tokenToSell.address,
            amountToSell,
            tokenToBuy.address,
            this.wallet.address,
            rawAmount,
            response.slippageRate,
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
}