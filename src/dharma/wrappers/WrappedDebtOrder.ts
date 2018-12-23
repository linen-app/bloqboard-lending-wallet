import { Contract } from 'ethers';
import { TransactionRequest, TransactionResponse } from 'ethers/providers';
import { DebtOrderData } from '../models/DebtOrderData';
import { BigNumber } from 'ethers/utils';
import { WrappedDebtOrderBase } from './WrappedDebtOrderBase';

export class WrappedDebtOrder extends WrappedDebtOrderBase {
    constructor(
        private readonly dharmaKernel: Contract,
        private readonly repaymentRouter: Contract,
        private readonly collateralizer: Contract,
        debtOrderData: DebtOrderData,
    ) {
        super(debtOrderData);
    }

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
            this.debtOrderData.principal.token.address,
            txOpts,
        );
    }

    returnCollateral(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        return this.collateralizer.returnCollateral(
            this.getIssuanceCommitmentHash(),
            txOpts,
        );
    }
}