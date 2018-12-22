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
export class DebtOrderWrapperFactory {
    constructor(
        @Inject('dharma-kernel-contract') private readonly dharmaKernel: Contract,
        @Inject('repayment-router-contract') private readonly repaymentRouter: Contract,
        @Inject('collateralizer-contract') private readonly collateralizer: Contract,
    ) { }

    wrap(debtOrderData: DebtOrderData): IDebtOrderWrapper {
        const getIssuanceCommitmentHash = (): string =>
            Web3Utils.soliditySHA3(
                debtOrderData.issuanceVersion,
                debtOrderData.debtor,
                debtOrderData.underwriter,
                debtOrderData.underwriterRiskRating,
                debtOrderData.termsContract,
                debtOrderData.termsContractParameters,
                debtOrderData.salt,
            );

        const getOrderAddresses = (): string[] =>
            [
                debtOrderData.issuanceVersion,
                debtOrderData.debtor,
                debtOrderData.underwriter,
                debtOrderData.termsContract,
                debtOrderData.principalToken,
                debtOrderData.relayer,
            ];

        const getOrderValues = (): string[] =>
            [
                debtOrderData.underwriterRiskRating,
                debtOrderData.salt,
                debtOrderData.principalAmount,
                debtOrderData.underwriterFee,
                debtOrderData.relayerFee,
                debtOrderData.creditorFee,
                debtOrderData.debtorFee,
                debtOrderData.expirationTimestampInSec,
            ].map(x => x.toString());

        const getOrderBytes32 = (): string[] => [debtOrderData.termsContractParameters];

        const getSignaturesR = (): string[] => {
            const [debtorSignature, creditorSignature, underwriterSignature] = getSignatures();

            return [debtorSignature.r, creditorSignature.r, underwriterSignature.r];
        };

        const getSignaturesS = (): string[] => {
            const [debtorSignature, creditorSignature, underwriterSignature] = getSignatures();

            return [debtorSignature.s, creditorSignature.s, underwriterSignature.s];
        };

        const getSignaturesV = (): number[] => {
            const [debtorSignature, creditorSignature, underwriterSignature] = getSignatures();

            return [debtorSignature.v, creditorSignature.v, underwriterSignature.v];
        };

        const getSignatures = (): ECDSASignature[] => {
            const { debtorSignature, creditorSignature, underwriterSignature } = debtOrderData;

            return [debtorSignature, creditorSignature, underwriterSignature];
        };

        return {
            async fill(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
                // TODO: add asserts for filliability

                return this.debtKernel.fillDebtOrder(
                    debtOrderData.creditor,
                    getOrderAddresses(),
                    getOrderValues(),
                    getOrderBytes32(),
                    getSignaturesV(),
                    getSignaturesR(),
                    getSignaturesS(),
                    txOpts,
                );
            },

            repay(amount: BigNumber, txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
                // TODO: determine collateral automatically

                return this.repaymentRouter.repay(
                    getIssuanceCommitmentHash(),
                    amount.toString(),
                    debtOrderData.principalToken,
                    txOpts,
                );
            },

            returnCollateral(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {

                return this.collateralizer.returnCollateral(
                    getIssuanceCommitmentHash(),
                    txOpts,
                );
            },
        };
    }
}