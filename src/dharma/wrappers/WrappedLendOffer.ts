// External libraries
import { Contract, constants, Wallet } from 'ethers';
import * as singleLineString from 'single-line-string';
import { TransactionResponse, TransactionRequest, Provider } from 'ethers/providers';
import { BigNumber } from 'ethers/utils';
import * as ContractArtifacts from 'dharma-contract-artifacts';
// Artifacts

import { ECDSASignature } from '../models/ECDSASignature';
import { Price } from '../models/Price';
import { Address, equals } from '../../types';
import { UnpackedDebtOrderData } from '../models/UnpackedDebtOrderData';
import { WrappedDebtOrderBase } from './WrappedDebtOrderBase';
import { MessageSigner } from '../MessageSigner';

const MAX_LTV_LOAN_OFFER_ERRORS = {
    IS_NOT_SIGNED_BY_CREDITOR: () => `The creditor has not signed the loan offer.`,
    ALREADY_SIGNED_BY_DEBTOR: () =>
        `The debtor has already signed the loan offer.`,
    COLLATERAL_AMOUNT_NOT_SET: () => `The collateral amount must be set first`,
    INSUFFICIENT_COLLATERAL_AMOUNT: (
        collateralAmount: number,
        collateralTokenSymbol: string,
    ) =>
        singleLineString`Collateral of ${collateralAmount} ${collateralTokenSymbol} is insufficient
            for the maximum loan-to-value.`,
    PRICE_OF_INCORRECT_TOKEN: (
        receivedAddress: string,
        expectedAddress: string,
    ) =>
        singleLineString`Received price of token at address ${receivedAddress},
            but expected price of token at address ${expectedAddress}.`,
    PRICES_NOT_SET: () =>
        `The prices of the principal and collateral must be set first.`,
    DEBTOR_NOT_SET: () => `Debtor address is not set. Sign order first or specify debtor address when accepting order`,
    INCORRECT_DEBTOR: (receivedDebtor, expectedDebtor) => `Received invalid debtor address ${receivedDebtor}. Expected: ${expectedDebtor}`,
};

export class WrappedLendOffer extends WrappedDebtOrderBase {

    private collateralAmount?: BigNumber;
    private collateralPrice?: Price;
    private debtorSignature?: ECDSASignature;
    private principalPrice?: Price;

    constructor(
        private readonly ltvCreditorProxyContract: Contract,
        private readonly signer: MessageSigner,
        private readonly repaymentRouter: Contract,
        private readonly collateralizer: Contract,
        private readonly wallet: Wallet,
        private readonly data: UnpackedDebtOrderData,
    ) {
        super(data);
    }

    get collateralToken() {
        return this.data.collateral.token;
    }

    get principal() {
        return this.data.principal;
    }

    isSignedByCreditor(): boolean {
        // TODO: check validity of signature
        if (this.data.creditorSignature) {
            return true;
        }

        return false;
    }

    setPrincipalPrice(principalPrice: Price) {
        if (!equals(principalPrice.tokenAddress.toLowerCase(), this.data.principal.token.address.toLowerCase())) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.PRICE_OF_INCORRECT_TOKEN(
                    principalPrice.tokenAddress,
                    this.data.principal.token.address,
                ),
            );
        }

        // TODO: assert signed time is within some delta of current time

        this.principalPrice = principalPrice;
    }

    setCollateralPrice(collateralPrice: Price) {
        if (!equals(collateralPrice.tokenAddress.toLowerCase(), this.data.collateral.token.address.toLowerCase())) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.PRICE_OF_INCORRECT_TOKEN(
                    collateralPrice.tokenAddress,
                    this.data.collateral.token.address,
                ),
            );
        }

        // TODO: assert signed time is within some delta of current time

        this.collateralPrice = collateralPrice;
    }

    setCollateralAmount(collateralAmount: BigNumber) {
        if (
            this.principalPrice &&
            this.collateralPrice &&
            !this.collateralAmountIsSufficient(collateralAmount)
        ) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.INSUFFICIENT_COLLATERAL_AMOUNT(
                    collateralAmount.toNumber(),
                    this.data.collateral.token.symbol,
                ),
            );
        }

        this.collateralAmount = collateralAmount;

        // calculate the terms contract parameters, since the collateral amount has been set
        this.data.termsContractParameters = this.updateTermsContractParameters(collateralAmount);
    }

    async signAsDebtor(debtorAddress: string, addPrefix: boolean = true): Promise<void> {

        if (!this.isSignedByCreditor()) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.IS_NOT_SIGNED_BY_CREDITOR(),
            );
        }

        if (this.isSignedByDebtor()) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.ALREADY_SIGNED_BY_DEBTOR(),
            );
        }

        if (!this.principalPrice || !this.collateralPrice) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.PRICES_NOT_SET());
        }

        if (!this.collateralAmount) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.COLLATERAL_AMOUNT_NOT_SET(),
            );
        }

        if (!this.collateralAmountIsSufficient(this.collateralAmount)) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.INSUFFICIENT_COLLATERAL_AMOUNT(
                    this.collateralAmount.toNumber(),
                    this.data.collateral.token.symbol,
                ),
            );
        }

        this.data.debtor = debtorAddress;

        const debtorCommitmentHash = this.getDebtorCommitmentHash();

        this.debtorSignature = await this.signer.ecSign(
            debtorCommitmentHash,
            addPrefix,
        );
    }

    isSignedByDebtor(): boolean {
        // TODO: check validity of signature
        if (this.debtorSignature) {
            return true;
        }

        return false;
    }

    async acceptAsDebtor(debtorAddress: string, txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        if (this.data.debtor === undefined && debtorAddress === undefined) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.DEBTOR_NOT_SET());
        }

        if (this.data.debtor && debtorAddress && this.data.debtor !== debtorAddress) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.INCORRECT_DEBTOR(debtorAddress, this.data.debtor));
        }

        if (!this.principalPrice || !this.collateralPrice) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.PRICES_NOT_SET());
        }

        if (!this.collateralAmount) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.COLLATERAL_AMOUNT_NOT_SET());
        }

        if (!this.collateralAmountIsSufficient(this.collateralAmount)) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.INSUFFICIENT_COLLATERAL_AMOUNT(
                    this.collateralAmount.toNumber(),
                    this.data.collateral.token.symbol,
                ),
            );
        }
        const debtor = this.data.debtor || debtorAddress;

        const lTVParams: LTVParams = {
            order: {
                creditor: this.data.creditor,
                principalToken: this.data.principal.token.address,
                principalAmount: this.data.principal.rawAmount,
                collateralAmount: this.collateralAmount,
                collateralToken: this.data.collateral.token.address,
                debtor,
                debtorFee: this.data.debtorFee.rawAmount,
                relayer: this.data.relayer,
                relayerFee: this.data.relayerFee.rawAmount,
                underwriterFee: this.data.underwriterFee.rawAmount,
                debtorSignature: this.debtorSignature || ECDSASignature.NULL_SIGNATURE,
                underwriterSignature: ECDSASignature.NULL_SIGNATURE,
                creditorSignature: this.data.creditorSignature,
                issuanceVersion: this.data.issuanceVersion,
                kernelVersion: this.data.kernelVersion,
                creditorFee: this.data.creditorFee.rawAmount,
                underwriter: this.data.underwriter,
                underwriterRiskRating: this.data.underwriterRiskRating,
                termsContract: this.data.termsContract,
                termsContractParameters: this.data.termsContractParameters,
                expirationTimestampInSec: this.data.expirationTimestampInSec,
                salt: this.data.salt,
            },
            collateralPrice: this.collateralPrice,
            principalPrice: this.principalPrice,
            creditorCommitment: {
                values: {
                    maxLTV: new BigNumber(this.data.maxLtv),
                    priceFeedOperator: this.data.priceProvider,
                },
                signature: this.data.creditorSignature,
            },
            creditor: this.data.creditor,
        };

        return await this.ltvCreditorProxyContract.fillDebtOffer(lTVParams, { ...txOpts, gasLimit: 1000000 });
    }

    async repay(amount: BigNumber, txOpts: TransactionRequest = {}): Promise<TransactionResponse> {

        if (amount.eq(constants.MaxUint256)) {
            amount = await this.getOutstandingRepaymentAmount();
        }

        return this.repaymentRouter.repay(
            this.getIssuanceCommitmentHash(),
            amount.toString(),
            this.debtOrderData.principal.token.address,
            { ...txOpts, gasLimit: 150000 },
        );
    }

    async getOutstandingRepaymentAmount() {
        const agreementId = this.getIssuanceCommitmentHash();
        const termsContract = new Contract(
            this.data.termsContract,
            ContractArtifacts.latest.SimpleInterestTermsContract,
            this.wallet.provider,
        );
        const repaymentToDate: BigNumber = await termsContract.getValueRepaidToDate(agreementId);

        const termEnd: BigNumber = await termsContract.getTermEndTimestamp(agreementId);

        const expectedTotalRepayment: BigNumber = await termsContract.getExpectedRepaymentValue(
            agreementId,
            termEnd,
        );

        return expectedTotalRepayment.sub(repaymentToDate);
    }

    returnCollateral(txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        return this.collateralizer.returnCollateral(
            this.getIssuanceCommitmentHash(),
            { ...txOpts, gasLimit: 150000 } ,
        );
    }

    private updateTermsContractParameters(collateralAmount: BigNumber): string {
        const encodedCollateralAmount = collateralAmount.toHexString().substring(2).padStart(23, '0');

        if (encodedCollateralAmount.length !== 23) {
            throw new Error('Collateral amount value is too long');
        }

        const result = this.data.termsContractParameters.substr(0, 39 + 2) + // +2 is for collateralTokenIndex
            encodedCollateralAmount +
            this.data.termsContractParameters.substr(39 + 2, 2);

        return result;
    }

    private collateralAmountIsSufficient(collateralAmount: BigNumber): boolean {
        if (!this.principalPrice || !this.collateralPrice) {
            return false;
        }
        const PRECISION = 4;
        const principalValue = this.data.principal.rawAmount.mul(this.principalPrice.value);
        const collateralValue = collateralAmount.mul(this.collateralPrice.value);

        const ltv = principalValue.mul(10 ** PRECISION).div(collateralValue);

        return ltv.lte(this.data.maxLtv * (10 ** PRECISION));
    }
}

interface LTVParams {
    creditor: Address;

    creditorCommitment: {
        values: {
            maxLTV: BigNumber;
            priceFeedOperator: Address;
        };
        signature: ECDSASignature;
    };

    principalPrice: Price;
    collateralPrice: Price;

    order: {
        kernelVersion: Address;
        issuanceVersion: Address;
        principalAmount: BigNumber;
        principalToken: Address;
        collateralAmount: BigNumber;
        collateralToken: Address;
        debtor: Address;
        debtorFee: BigNumber;
        creditor: Address;
        creditorFee: BigNumber;
        relayer: Address;
        relayerFee: BigNumber;
        underwriter: Address;
        underwriterFee: BigNumber;
        underwriterRiskRating: BigNumber;
        termsContract: Address;
        termsContractParameters: string;
        expirationTimestampInSec: BigNumber;
        salt: BigNumber;
        debtorSignature: ECDSASignature;
        creditorSignature: ECDSASignature;
        underwriterSignature: ECDSASignature;
    };
}