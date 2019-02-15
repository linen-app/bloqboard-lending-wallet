import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { Contract, Wallet, ContractTransaction, ethers, constants } from 'ethers';
import { TokenService } from '../tokens/TokenService';
import { TransactionLog } from '../common-models/TransactionLog';
import { KyberService } from '../kyber/KyberService';
import { BigNumber } from 'ethers/utils';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenAmount } from '../tokens/TokenAmount';

@Injectable()
export class MakerDaoService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        private readonly kyberService: KyberService,
        @Inject('winston') private readonly logger: Logger,
        @Inject('makerdao-contract') private readonly makerDaoContract: Contract,
    ) { }

    async getCdps(): Promise<string[]> {
        const cdpsLength: BigNumber = await this.makerDaoContract.cdpsByOwnerLength(this.wallet.address);

        const res: string[] = [];
        for (let i = 0; i < cdpsLength.toNumber(); i++) {
            res.push(await this.makerDaoContract.cdpsByOwner(this.wallet.address, i));
        }

        return res;
    }

    async getCdpInfo(cdpId: string): Promise<{
        borrowedDai: number,
        outstandingDai: number,
        suppliedPeth: number,
    }> {
        const res = await this.makerDaoContract.cdpInfo(cdpId);
        const dai = this.tokenService.getTokenBySymbol(TokenSymbol.DAI);
        const peth = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);

        return {
            borrowedDai: new TokenAmount(res.borrowedDai, dai).humanReadableAmount,
            outstandingDai: new TokenAmount(res.outstandingDai, dai).humanReadableAmount,
            suppliedPeth: new TokenAmount(res.suppliedPeth, peth).humanReadableAmount,
        };
    }

    async supplyAndBorrow(
        cdpId: string,
        humanReadableWethTokenAmount: number,
        humanReadableDaiTokenAmount: number,
        needAwaitMining: boolean,
        transactions: TransactionLog = new TransactionLog(),
    ): Promise<TransactionLog> {
        const weth = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);
        const dai = this.tokenService.getTokenBySymbol(TokenSymbol.DAI);
        const wethAmount = TokenAmount.fromHumanReadable(humanReadableWethTokenAmount, weth);
        const daiAmount = TokenAmount.fromHumanReadable(humanReadableDaiTokenAmount, dai);

        await this.tokenService.assertTokenBalance(wethAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(TokenSymbol.WETH, this.makerDaoContract.address, transactions);

        const supplyAndBorrowTx: ContractTransaction = await this.makerDaoContract.supplyWethAndBorrowDai(
            cdpId || constants.HashZero,
            wethAmount.rawAmount,
            daiAmount.rawAmount,
            { nonce: transactions.getNextNonce(), gasLimit: 543270 },
        );

        this.logger.info(`Supplying ${wethAmount} and borrowing ${daiAmount}`);

        transactions.add({
            name: 'supplyAndBorrow',
            transactionObject: supplyAndBorrowTx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }
        return transactions;
    }

    async repayAndWithdraw(
        cdpId: string,
        humanReadableWethTokenAmount: number,
        humanReadableDaiTokenAmount: number,
        needAwaitMining: boolean,
        transactions: TransactionLog = new TransactionLog(),
    ): Promise<TransactionLog> {
        const weth = this.tokenService.getTokenBySymbol(TokenSymbol.WETH);
        const dai = this.tokenService.getTokenBySymbol(TokenSymbol.DAI);
        const wethAmount = TokenAmount.fromHumanReadable(humanReadableWethTokenAmount, weth);
        const daiAmount = TokenAmount.fromHumanReadable(humanReadableDaiTokenAmount, dai);

        await this.tokenService.assertTokenBalance(daiAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(TokenSymbol.DAI, this.makerDaoContract.address, transactions);

        const repayAndWithdrawTx: ContractTransaction = await this.makerDaoContract.repayDaiAndReturnWeth(
            cdpId || constants.HashZero,
            daiAmount.rawAmount,
            wethAmount.rawAmount,
            true,
            { nonce: transactions.getNextNonce(), gasLimit: 543270 },
        );

        this.logger.info(`Repaying ${daiAmount} and withdrawing ${wethAmount}`);

        transactions.add({
            name: 'repayAndWithdraw',
            transactionObject: repayAndWithdrawTx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }
        return transactions;
    }
}
