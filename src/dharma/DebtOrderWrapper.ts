import { ECDSASignature } from './models/ECDSASignature';
import { Contract } from 'ethers';
import { TransactionRequest, TransactionResponse } from 'ethers/providers';
import { DebtOrderData } from './models/DebtOrderData';
import { BigNumber } from 'ethers/utils';
import * as Web3Utils from 'web3-utils';
import { Inject, Injectable } from '@nestjs/common';

export interface IDebtOrderWrapper {
    fill(txOpts: TransactionRequest): Promise<TransactionResponse>;
    repay(amount: BigNumber, txOpts: TransactionRequest): Promise<TransactionResponse>;
    returnCollateral(txOpts: TransactionRequest): Promise<TransactionResponse>;
}

@Injectable()
export class DebtOrderWrapper {
    constructor(
        @Inject('dharma-kernel-contract') private readonly dharmaKernel: Contract,
        @Inject('repayment-router-contract') private readonly repaymentRouter: Contract,
        @Inject('collateralizer-contract') private readonly collateralizer: Contract,
    ) { }

    wrap = (debtOrderData: DebtOrderData): IDebtOrderWrapper =>
        new WrappedDebtOrder(this.dharmaKernel, this.repaymentRouter, this.collateralizer, debtOrderData)
}

class WrappedDebtOrder {
    constructor(
        private readonly dharmaKernel: Contract,
        private readonly repaymentRouter: Contract,
        private readonly collateralizer: Contract,
        private readonly debtOrderData: DebtOrderData,
    ) { }

    fill(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        // TODO: add asserts for filliability

        return this.dharmaKernel.fillDebtOrder(
            this.debtOrderData.creditor,
            this.getOrderAddresses(),
            this.getOrderValues(),
            this.getOrderBytes32(),
            this.getSignaturesV(),
            this.getSignaturesR(),
            this.getSignaturesS(),
            txOpts,
        );
    }

    repay(amount: BigNumber, txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        // TODO: determine collateral automatically
        return this.repaymentRouter.repay(
            this.getIssuanceCommitmentHash(),
            amount.toString(),
            this.debtOrderData.principalToken,
            txOpts,
        );
    }

    returnCollateral(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        return this.collateralizer.returnCollateral(
            this.getIssuanceCommitmentHash(),
            txOpts,
        );
    }

    private getIssuanceCommitmentHash = (): string =>
        Web3Utils.soliditySHA3(
            this.debtOrderData.issuanceVersion,
            this.debtOrderData.debtor,
            this.debtOrderData.underwriter,
            this.debtOrderData.underwriterRiskRating,
            this.debtOrderData.termsContract,
            this.debtOrderData.termsContractParameters,
            this.debtOrderData.salt,
        )

    private getOrderAddresses = (): string[] =>
        [
            this.debtOrderData.issuanceVersion,
            this.debtOrderData.debtor,
            this.debtOrderData.underwriter,
            this.debtOrderData.termsContract,
            this.debtOrderData.principalToken,
            this.debtOrderData.relayer,
        ]

    private getOrderValues = (): string[] =>
        [
            this.debtOrderData.underwriterRiskRating,
            this.debtOrderData.salt,
            this.debtOrderData.principalAmount,
            this.debtOrderData.underwriterFee,
            this.debtOrderData.relayerFee,
            this.debtOrderData.creditorFee,
            this.debtOrderData.debtorFee,
            this.debtOrderData.expirationTimestampInSec,
        ].map(x => x.toString())

    private getOrderBytes32 = (): string[] => [this.debtOrderData.termsContractParameters];

    private getSignaturesR = (): string[] => {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.r, creditorSignature.r, underwriterSignature.r];
    }

    private getSignaturesS = (): string[] => {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.s, creditorSignature.s, underwriterSignature.s];
    }

    private getSignaturesV = (): number[] => {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.v, creditorSignature.v, underwriterSignature.v];
    }

    private getSignatures = (): ECDSASignature[] => {
        const { debtorSignature, creditorSignature, underwriterSignature } = this.debtOrderData;

        return [debtorSignature, creditorSignature, underwriterSignature];
    }
}