// External libraries
import { Contract } from 'ethers';
import * as singleLineString from 'single-line-string';
import { TransactionResponse, TransactionRequest } from 'ethers/providers';
import { BigNumber } from 'ethers/utils';
// Artifacts

import { ECDSASignature } from '../models/ECDSASignature';
import { Price } from '../models/Price';
import { Address, equals } from '../../types';
import { UnpackedDebtOrderData } from '../models/UnpackedDebtOrderData';
import { WrappedDebtOrderBase } from './WrappedDebtOrderBase';
import { MessageSigner } from '../MessageSigner';
import { TokenAmount } from '../../tokens/TokenAmount';
import {
    CollateralizedContractTerms,
    SimpleInterestContractTerms,
    CollateralizedSimpleInterestTermsParameters,
} from '../ltv-creditor-proxy-wrapper/TermsContractParameters';

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
    private debtor?: Address;
    private debtorSignature?: ECDSASignature;
    private principalPrice?: Price;
    private termsContractParameters?: string;

    constructor(
        private readonly ltvCreditorProxyContract: Contract,
        private readonly signer: MessageSigner,
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

    public isSignedByCreditor(): boolean {
        // TODO: check validity of signature
        if (this.data.creditorSignature) {
            return true;
        }

        return false;
    }

    public setPrincipalPrice(principalPrice: Price) {
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

    public setCollateralPrice(collateralPrice: Price) {
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

    public setCollateralAmount(collateralAmount: BigNumber) {
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
        this.termsContractParameters = this.getTermsContractParameters();
    }

    public async signAsDebtor(debtorAddress: string, addPrefix: boolean = true): Promise<void> {

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

        this.debtor = debtorAddress;

        const debtorCommitmentHash = this.getDebtorCommitmentHash();

        this.debtorSignature = await this.signer.ecSign(
            debtorCommitmentHash,
            addPrefix,
        );
    }

    public isSignedByDebtor(): boolean {
        // TODO: check validity of signature
        if (this.debtorSignature) {
            return true;
        }

        return false;
    }

    public async acceptAsDebtor(debtorAddress: string, txOpts: TransactionRequest = {}): Promise<TransactionResponse> {
        if (this.debtor === undefined && debtorAddress === undefined) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.DEBTOR_NOT_SET());
        }

        if (this.debtor && debtorAddress && this.debtor !== debtorAddress) {
            throw new Error(MAX_LTV_LOAN_OFFER_ERRORS.INCORRECT_DEBTOR(debtorAddress, this.debtor));
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
        const debtor = this.debtor || debtorAddress;

        const lTVParams: LTVParams = {
            order: {
                creditor: this.data.creditor,
                principalToken: this.data.principal.token.address,
                principalAmount: this.data.principal.rawAmount.toString(),
                collateralAmount: this.collateralAmount.toString(),
                collateralToken: this.data.collateral.token.address,
                debtor,
                debtorFee: this.data.debtorFee.rawAmount.toString(),
                relayer: this.data.relayer,
                relayerFee: this.data.relayerFee.rawAmount.toString(),
                underwriterFee: this.data.underwriterFee.rawAmount.toString(),
                debtorSignature: this.debtorSignature || ECDSASignature.NULL_SIGNATURE,
                underwriterSignature: ECDSASignature.NULL_SIGNATURE,
                creditorSignature: this.data.creditorSignature,
                issuanceVersion: this.data.issuanceVersion,
                kernelVersion: this.data.kernelVersion,
                creditorFee: this.data.creditorFee.rawAmount.toString(),
                underwriter: this.data.underwriter,
                underwriterRiskRating: this.data.underwriterRiskRating.toString(),
                termsContract: this.data.termsContract,
                termsContractParameters: this.termsContractParameters,
                expirationTimestampInSec: this.data.expirationTimestampInSec.toString(),
                salt: this.data.salt.toString(),
            },
            collateralPrice: this.collateralPrice,
            principalPrice: this.principalPrice,
            creditorCommitment: {
                values: {
                    maxLTV: this.data.maxLtv,
                    priceFeedOperator: this.data.priceProvider,
                },
                signature: this.data.creditorSignature,
            },
            creditor: this.data.creditor,
        };

        return await this.ltvCreditorProxyContract.fillDebtOffer(lTVParams, txOpts);
    }

    private getTermsContractParameters(): string {
        const MAX_INTEREST_RATE_PRECISION = 4;
        const FIXED_POINT_SCALING_FACTOR = 10 ** MAX_INTEREST_RATE_PRECISION;

        const collateral = new TokenAmount(
            this.collateralAmount,
            this.data.collateral.token,
        );

        // Pack terms contract parameters
        const collateralizedContractTerms: CollateralizedContractTerms = {
            collateralAmount: collateral.rawAmount.toString(),
            collateralTokenIndex: this.data.collateralTokenIndex.toNumber(),
            gracePeriodInDays: 0,
        };

        const simpleInterestContractTerms: SimpleInterestContractTerms = {
            principalTokenIndex: this.data.principalTokenIndex.toNumber(),
            principalAmount: this.data.principal.rawAmount.toString(),
            interestRateFixedPoint: this.data.interestRate
                .mul(FIXED_POINT_SCALING_FACTOR)
                .toNumber(),
            amortizationUnitType: this.data.amortizationUnit,
            termLengthUnits: this.data.termLength.toNumber(),
        };

        return CollateralizedSimpleInterestTermsParameters.pack(
            collateralizedContractTerms,
            simpleInterestContractTerms,
        );
    }

    private collateralAmountIsSufficient(collateralAmount: BigNumber): boolean {
        if (!this.principalPrice || !this.collateralPrice) {
            return false;
        }
        const PRECISION = 4;
        const principalValue = this.data.principal.rawAmount.mul(this.principalPrice.value);
        const collateralValue = collateralAmount.mul(this.collateralPrice.value);

        const ltv = principalValue.mul(10 ** PRECISION).div(collateralValue);

        return ltv.lte(this.data.maxLtv.mul(10 ** PRECISION));
    }
}

interface LTVParams {
    creditor: string;

    creditorCommitment: {
        values: {
            maxLTV: BigNumber;
            priceFeedOperator: string;
        };
        signature: ECDSASignature;
    };

    principalPrice: Price;
    collateralPrice: Price;

    order: {
        kernelVersion: string;
        issuanceVersion: string;
        principalAmount: string;
        principalToken: string;
        collateralAmount: string;
        collateralToken: string;
        debtor: string;
        debtorFee: string;
        creditor: string;
        creditorFee: string;
        relayer: string;
        relayerFee: string;
        underwriter: string;
        underwriterFee: string;
        underwriterRiskRating: string;
        termsContract: string;
        termsContractParameters: string;
        expirationTimestampInSec: string;
        salt: string;
        debtorSignature: ECDSASignature;
        creditorSignature: ECDSASignature;
        underwriterSignature: ECDSASignature;
    };
}