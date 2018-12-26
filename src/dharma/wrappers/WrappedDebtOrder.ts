import { Contract } from 'ethers';
import { TransactionRequest, TransactionResponse } from 'ethers/providers';
import { DebtOrderData } from '../models/DebtOrderData';
import { WrappedDebtOrderBase } from './WrappedDebtOrderBase';

export class WrappedDebtOrder extends WrappedDebtOrderBase {
    constructor(
        private readonly dharmaKernel: Contract,
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
            { ...txOpts, gasLimit: 600000 },
        );
    }
}