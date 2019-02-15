import { Injectable, Inject } from '@nestjs/common';
import { ContractTransaction, Contract } from 'ethers';
import { TokenAmount } from './TokenAmount';
import { TokenSymbol } from './TokenSymbol';
import { TokenService } from './TokenService';
import { TransactionLog } from '../common-models/TransactionLog';
import { Logger } from 'winston';

@Injectable()
export class WrappedEtherService{
    constructor(
        @Inject('wrapped-ether-contract') private readonly wrappedEtherContract: Contract,
        private readonly tokenService: TokenService,
        @Inject('winston') private readonly logger: Logger,
    ) { }

    async wrapEth(
        humanReadableAmount: number,
        needAwaitMining: boolean,
        transactions: TransactionLog = new TransactionLog(),
    ): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, token);
        const tx: ContractTransaction = await this.wrappedEtherContract.deposit(
            { nonce: transactions.getNextNonce(), value: amount.rawAmount, gasLimit: 800000 },
        );

        this.logger.info(`Wrapping ${amount.humanReadableAmount} ETH`);

        transactions.add({
            name: 'wrap',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    async unwrapEth(
        humanReadableAmount: number,
        needAwaitMining: boolean,
        transactions: TransactionLog = new TransactionLog(),
    ): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, token);
        const tx: ContractTransaction = await this.wrappedEtherContract.withdraw(
            amount.rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 800000 },
        );

        this.logger.info(`Unwrapping ${amount.humanReadableAmount} ETH`);

        transactions.add({
            name: 'unwrap',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }
}