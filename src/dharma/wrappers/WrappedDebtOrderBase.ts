import { DebtOrderData } from '../models/DebtOrderData';
import * as Web3Utils from 'web3-utils';
import { ECDSASignature } from '../models/ECDSASignature';
import { BigNumber } from 'ethers/utils';

export abstract class WrappedDebtOrderBase {
    constructor(protected readonly debtOrderData: DebtOrderData) { }

    /**
     * Returns the hash of this debt order's "Issuance Commitment".
     * See https://whitepaper.dharma.io/#debt-issuance-commitments
     *
     * @return Hash of the issuance commitment associated with this debt order.
     */
    protected getIssuanceCommitmentHash(): string {
        return Web3Utils.soliditySHA3(
            this.debtOrderData.issuanceVersion,
            this.debtOrderData.debtor,
            this.debtOrderData.underwriter,
            this.debtOrderData.underwriterRiskRating.toString(),
            this.debtOrderData.termsContract,
            this.debtOrderData.termsContractParameters,
            this.debtOrderData.salt.toString(),
        );
    }

    /**
     * Returns the hash of the debt order in its entirety, in the order defined
     * in the Dharma whitepaper.
     * See https://whitepaper.dharma.io/#debtorcreditor-commitment-hash
     *
     * @return The debt order's hash
     */
    protected getHash(): string {
        return Web3Utils.soliditySHA3(
            this.debtOrderData.kernelVersion,
            this.getIssuanceCommitmentHash(),
            this.debtOrderData.underwriterFee.rawAmount.toString(),
            this.debtOrderData.principal.rawAmount.toString(),
            this.debtOrderData.principal.token.address,
            this.debtOrderData.debtorFee.rawAmount.toString(),
            this.debtOrderData.creditorFee.rawAmount.toString(),
            this.debtOrderData.relayer,
            this.debtOrderData.relayerFee.rawAmount.toString(),
            this.debtOrderData.expirationTimestampInSec.toString(),
        );
    }

    /**
     * Returns the debt agreement's unique identifier --
     * an alias for the issuance commitment hash cast to a BigNumber
     *
     * @return Debt agreement id.
     */
    protected getDebtAgreementId(): BigNumber {
        return new BigNumber(this.getHash());
    }

    /**
     * Returns the payload that a debtor must sign in order to
     * indicate her consent to the parameters of the debt order --
     * which is, currently, the debt order's hash.
     *
     * @return Debtor commitment hash
     */
    protected getDebtorCommitmentHash(): string {
        return this.getHash();
    }

    /**
     * Returns the payload that a creditor must sign in order to
     * indicate her consent to the parameters of the debt order --
     * which is, currently, the debt order's hash.
     *
     * @return
     * creditor commitment hash
     */
    protected getCreditorCommitmentHash(): string {
        return this.getHash();
    }

    protected getOrderAddresses(): string[] {
        return [
            this.debtOrderData.issuanceVersion,
            this.debtOrderData.debtor,
            this.debtOrderData.underwriter,
            this.debtOrderData.termsContract,
            this.debtOrderData.principal.token.address,
            this.debtOrderData.relayer,
        ];
    }

    protected getOrderValues(): BigNumber[] {
        return [
            this.debtOrderData.underwriterRiskRating,
            this.debtOrderData.salt,
            this.debtOrderData.principal.rawAmount,
            this.debtOrderData.underwriterFee.rawAmount,
            this.debtOrderData.relayerFee.rawAmount,
            this.debtOrderData.creditorFee.rawAmount,
            this.debtOrderData.debtorFee.rawAmount,
            this.debtOrderData.expirationTimestampInSec,
        ];
    }

    protected getOrderBytes32(): string[] {
        return [this.debtOrderData.termsContractParameters];
    }

    protected getSignaturesR(): string[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.r, creditorSignature.r, underwriterSignature.r];
    }

    protected getSignaturesS(): string[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.s, creditorSignature.s, underwriterSignature.s];
    }

    protected getSignaturesV(): number[] {
        const [debtorSignature, creditorSignature, underwriterSignature] = this.getSignatures();

        return [debtorSignature.v, creditorSignature.v, underwriterSignature.v];
    }

    private getSignatures(): ECDSASignature[] {
        let { debtorSignature, creditorSignature, underwriterSignature } = this.debtOrderData;

        debtorSignature = debtorSignature || ECDSASignature.NULL_SIGNATURE;
        creditorSignature = creditorSignature || ECDSASignature.NULL_SIGNATURE;
        underwriterSignature = underwriterSignature || ECDSASignature.NULL_SIGNATURE;

        return [debtorSignature, creditorSignature, underwriterSignature];
    }
}