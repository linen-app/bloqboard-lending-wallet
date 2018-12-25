import { Contract } from 'ethers';
import { DebtOrderData } from '../models/DebtOrderData';
import { Inject, Injectable } from '@nestjs/common';
import { WrappedDebtOrder } from './WrappedDebtOrder';
import { WrappedLendOffer } from './WrappedLendOffer';
import { UnpackedDebtOrderData } from '../models/UnpackedDebtOrderData';
import { MessageSigner } from '../MessageSigner';
@Injectable()
export class DebtOrderWrapper {
    constructor(
        @Inject('dharma-kernel-contract') private readonly dharmaKernel: Contract,
        @Inject('repayment-router-contract') private readonly repaymentRouter: Contract,
        @Inject('collateralizer-contract') private readonly collateralizer: Contract,
        @Inject('ltv-creditor-proxy-contract') private readonly ltvCreditorProxyContract: Contract,
        private readonly signer: MessageSigner,
    ) { }

    wrapDebtOrder = (debtOrderData: DebtOrderData): WrappedDebtOrder =>
        new WrappedDebtOrder(
            this.dharmaKernel,
            debtOrderData,
        )

    wrapLendOffer = (debtOrderData: UnpackedDebtOrderData) =>
        new WrappedLendOffer(
            this.ltvCreditorProxyContract,
            this.signer,
            this.repaymentRouter,
            this.collateralizer,
            debtOrderData,
        )
}
