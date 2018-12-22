import { ECDSASignature } from './models/ECDSASignature';
import { Contract } from 'ethers';
import { TransactionRequest, TransactionResponse } from 'ethers/providers';
import { DebtOrderData } from './models/DebtOrderData';

/**
 * Decorate a given debt order with various higher level functions.
 */
export class DebtOrderWrapper {
    constructor(
        private readonly debtOrderData: DebtOrderData,
        private readonly debtKernel: Contract,
    ) { }

    async fillDebtOrder(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        // TODO: add asserts for filliability

        const tx = await this.debtKernel.fillDebtOrder(
            this.debtOrderData.creditor,
            this.getOrderAddresses(),
            this.getOrderValues(),
            this.getOrderBytes32(),
            this.getSignaturesV(),
            this.getSignaturesR(),
            this.getSignaturesS(),
            txOpts,
        );

        return tx;
    }

    private getOrderAddresses(): string[] {
        return [
            this.debtOrderData.issuanceVersion,
            this.debtOrderData.debtor,
            this.debtOrderData.underwriter,
            this.debtOrderData.termsContract,
            this.debtOrderData.principalToken,
            this.debtOrderData.relayer,
        ];
    }

    private getOrderValues(): string[] {
        return [
            this.debtOrderData.underwriterRiskRating,
            this.debtOrderData.salt,
            this.debtOrderData.principalAmount,
            this.debtOrderData.underwriterFee,
            this.debtOrderData.relayerFee,
            this.debtOrderData.creditorFee,
            this.debtOrderData.debtorFee,
            this.debtOrderData.expirationTimestampInSec,
        ].map(x => x.toString());
    }

    private getOrderBytes32(): string[] {
        return [this.debtOrderData.termsContractParameters];
    }

    private getSignaturesR(): string[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.r, creditorSignature.r, underwriterSignature.r];
    }

    private getSignaturesS(): string[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.s, creditorSignature.s, underwriterSignature.s];
    }

    private getSignaturesV(): number[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.v, creditorSignature.v, underwriterSignature.v];
    }

    private getSignatures(): ECDSASignature[] {
        const { debtorSignature, creditorSignature, underwriterSignature } = this.debtOrderData;

        return [debtorSignature, creditorSignature, underwriterSignature];
    }
}
