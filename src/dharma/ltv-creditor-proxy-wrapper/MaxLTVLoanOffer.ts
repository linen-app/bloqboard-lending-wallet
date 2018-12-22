// External libraries
import { ethers, Wallet } from 'ethers';
import * as singleLineString from 'single-line-string';
import * as contractArtifacts from 'dharma-contract-artifacts';
import * as Web3Utils from 'web3-utils';
// Artifacts
const { LTVCreditorProxy } = contractArtifacts.latest;

// Types
import { BigNumber } from 'bignumber.js';
import { TokenAmount } from '../models/TokenAmount';
import { SimpleInterestContractTerms, CollateralizedContractTerms, CollateralizedSimpleInterestTermsParameters } from './TermsContractParameters';
import { TimeInterval } from '../models/TimeInterval';
import { TransactionResponse, TransactionRequest } from 'ethers/providers';
import { InterestRate } from '../models/InterestRate';
import { ECDSASignature, ecSign } from '../models/ECDSASignature';
import { LTVParams } from '../models/LTVTypes';

const MAX_INTEREST_RATE_PRECISION = 4;
const FIXED_POINT_SCALING_FACTOR = 10 ** MAX_INTEREST_RATE_PRECISION;
const NULL_ADDRESS = ethers.constants.AddressZero;

const MAX_LTV_LOAN_OFFER_ERRORS = {
    ALREADY_SIGNED_BY_CREDITOR: () =>
        `The creditor has already signed the loan offer.`,
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

export interface CreditorValues {
    creditor: string;
    creditorSignature: ECDSASignature;
    expirationTimestampInSec: BigNumber;
}

// A price signed by the feed operator.
export interface Price {
    value: number;
    tokenAddress: string;
    timestamp: number;
    signature: ECDSASignature;
}

export interface MaxLTVData {
    collateralTokenAddress: string;
    collateralTokenIndex: BigNumber;
    collateralTokenSymbol: string;
    creditorFee: BigNumber;
    debtorFee: BigNumber;
    expiresIn: TimeInterval;
    interestRate: InterestRate;
    issuanceVersion: string;
    kernelVersion: string;
    maxLTV: BigNumber;
    priceProvider: string;
    principal: TokenAmount;
    principalTokenAddress: string;
    principalTokenIndex: BigNumber;
    relayer: string;
    relayerFee: TokenAmount;
    salt: BigNumber;
    termLength: TimeInterval;
    termsContract: string;
}

export class MaxLTVLoanOffer {

    // public static generateSalt(): BigNumber {
    //     return BigNumber.random(SALT_DECIMALS).times(
    //         new BigNumber(10).pow(SALT_DECIMALS),
    //     );
    // }

    private collateralAmount?: BigNumber;
    private collateralPrice?: Price;
    private creditor?: string;
    private creditorSignature?: ECDSASignature;
    private debtor?: string;
    private debtorSignature?: ECDSASignature;
    private expirationTimestampInSec?: BigNumber;
    private principalPrice?: Price;
    private termsContractParameters?: string;

    constructor(
        private readonly ltvProxyAddress: string,
        private readonly wallet: Wallet,
        private readonly data: MaxLTVData,
        creditorValues?: CreditorValues,
    ) {

        if (creditorValues) {
            this.creditor = creditorValues.creditor;
            this.creditorSignature = creditorValues.creditorSignature;
            this.expirationTimestampInSec = creditorValues.expirationTimestampInSec;
        }
    }

    /**
     * Eventually signs the loan offer as the creditor.
     *
     * @throws Throws if the loan offer is already signed by a creditor.
     *
     * @example
     * loanOffer.signAsCreditor();
     * => Promise<void>
     *
     * @return {Promise<void>}
     */
    public async signAsCreditor(creditorAddress: string, addPrefix: boolean = true): Promise<void> {
        if (this.isSignedByCreditor()) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.ALREADY_SIGNED_BY_CREDITOR(),
            );
        }

        this.creditor = creditorAddress;

        const currentBlocktime = new BigNumber(
            (await this.wallet.provider.getBlock('latest')).timestamp,
        );

        this.expirationTimestampInSec = this.data.expiresIn.fromTimestamp(
            currentBlocktime,
        );

        const loanOfferHash = this.getCreditorCommitmentHash();

        // TODO: integrate MetaMask prefix
        this.creditorSignature = await ecSign(
            this.wallet,
            loanOfferHash,
            addPrefix,
        );
    }

    /**
     * Returns whether the loan offer has been signed by a creditor.
     *
     * @example
     * loanOffer.isSignedByCreditor();
     * => true
     *
     * @return {boolean}
     */
    public isSignedByCreditor(): boolean {
        // TODO: check validity of signature
        if (this.creditorSignature) {
            return true;
        }

        return false;
    }

    /**
     * Sets the principal price.
     *
     * @throws Throws if the price is for the wrong token
     *
     * @example
     * loanOffer.setPrincipalPrice(signedPrincipalPrice);
     *
     */
    public setPrincipalPrice(principalPrice: Price) {
        if (principalPrice.tokenAddress.toLowerCase() !== this.data.principalTokenAddress.toLowerCase()) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.PRICE_OF_INCORRECT_TOKEN(
                    principalPrice.tokenAddress,
                    this.data.principalTokenAddress,
                ),
            );
        }

        // TODO: assert signed time is within some delta of current time

        this.principalPrice = principalPrice;
    }

    /**
     * Sets the collateral price.
     *
     * @throws Throws if the price is for the wrong token
     *
     * @example
     * loanOffer.setCollateralPrice(signedPrincipalPrice);
     *
     */
    public setCollateralPrice(collateralPrice: Price) {
        if (collateralPrice.tokenAddress.toLowerCase() !== this.data.collateralTokenAddress.toLowerCase()) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.PRICE_OF_INCORRECT_TOKEN(
                    collateralPrice.tokenAddress,
                    this.data.collateralTokenAddress,
                ),
            );
        }

        // TODO: assert signed time is within some delta of current time

        this.collateralPrice = collateralPrice;
    }

    /**
     * Sets the collateral amount.
     *
     * @throws Throws if the collateral amount is insufficient.
     *
     * @example
     * loanOffer.setCollateralAmount(1000);
     *
     */
    public setCollateralAmount(collateralAmount: BigNumber) {
        if (
            this.principalPrice &&
            this.collateralPrice &&
            !this.collateralAmountIsSufficient(collateralAmount)
        ) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.INSUFFICIENT_COLLATERAL_AMOUNT(
                    collateralAmount.toNumber(),
                    this.data.collateralTokenSymbol,
                ),
            );
        }

        this.collateralAmount = collateralAmount;

        // calculate the terms contract parameters, since the collateral amount has been set
        this.termsContractParameters = this.getTermsContractParameters();
    }

    /**
     * Eventually signs the loan offer as the debtor.
     *
     * @throws Throws if the loan offer is already signed by a debtor.
     * @throws Throws if the prices are not set.
     * @throws Throws if the collateral amount is not set.
     * @throws Throws if the collateral amount is insufficient.
     *
     * @example
     * loanOffer.signAsDebtor();
     * => Promise<void>
     *
     * @return {Promise<void>}
     */
    public async signAsDebtor(debtorAddress: string, addPrefix: boolean = true): Promise<void> {
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
                    this.data.collateralTokenSymbol,
                ),
            );
        }

        this.debtor = debtorAddress;

        const debtorCommitmentHash = this.getDebtorCommitmentHash();

        // TODO: integrate MetaMask prefix?
        this.debtorSignature = await ecSign(
            this.wallet,
            debtorCommitmentHash,
            addPrefix,
        );
    }

    /**
     * Returns whether the loan offer has been signed by a debtor.
     *
     * @example
     * loanOffer.isSignedByDebtor();
     * => true
     *
     * @return {boolean}
     */
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
                    this.data.collateralTokenSymbol,
                ),
            );
        }
        const debtor = this.debtor || debtorAddress;
        const collateral = new TokenAmount(this.collateralAmount, this.data.collateralTokenSymbol);

        // We convert BigNumbers into strings because of an issue with Web3 taking larger BigNumbers
        const lTVParams: LTVParams = {
            order: {
                creditor: this.creditor,
                principalToken: this.data.principalTokenAddress,
                principalAmount: this.data.principal.rawAmount.toString(),
                collateralAmount: collateral.rawAmount.toString(),
                collateralToken: this.data.collateralTokenAddress,
                debtor,
                debtorFee: this.data.debtorFee.toString(),
                relayer: this.data.relayer,
                relayerFee: this.data.relayerFee.rawAmount.toString(),
                underwriterFee: 0,
                debtorSignature: this.debtorSignature || ECDSASignature.NULL_SIGNATURE,
                underwriterSignature: ECDSASignature.NULL_SIGNATURE,
                creditorSignature: this.creditorSignature,
                // Order params
                issuanceVersion: this.data.issuanceVersion,
                kernelVersion: this.data.kernelVersion,
                creditorFee: this.data.creditorFee.toString(),
                underwriter: NULL_ADDRESS,
                underwriterRiskRating: 0,
                termsContract: this.data.termsContract,
                termsContractParameters: this.termsContractParameters,
                expirationTimestampInSec: this.expirationTimestampInSec.toString(),
                salt: this.data.salt.toString(),
            },
            collateralPrice: this.collateralPrice,
            principalPrice: this.principalPrice,
            creditorCommitment: {
                values: {
                    maxLTV: this.data.maxLTV.toString(),
                    priceFeedOperator: this.data.priceProvider,
                },
                signature: this.creditorSignature,
            },
            creditor: this.creditor,
        };

        const lTVCreditorProxyContract = new ethers.Contract(this.ltvProxyAddress, LTVCreditorProxy, this.wallet);

        return await lTVCreditorProxyContract.fillDebtOffer(lTVParams, txOpts);
    }

    private getTermsContractCommitmentHash(): string {
        return Web3Utils.soliditySha3(
            this.data.principalTokenIndex,
            this.data.principal.rawAmount,
            this.data.interestRate.raw
                .mul(FIXED_POINT_SCALING_FACTOR)
                .toNumber(),
            this.data.termLength.getAmortizationUnitType(),
            this.data.termLength.amount,
            this.data.collateralTokenIndex,
            0, // grace period in days
        );
    }

    private getCreditorCommitmentHash(): string {
        return Web3Utils.soliditySha3(
            this.creditor,
            this.data.kernelVersion,
            this.data.issuanceVersion,
            this.data.termsContract,
            this.data.principalTokenAddress,
            this.data.salt,
            this.data.principal.rawAmount,
            this.data.creditorFee,
            this.expirationTimestampInSec,
            this.data.maxLTV,
            this.data.priceProvider,
            this.getTermsContractCommitmentHash(),
        );
    }

    private getIssuanceCommitmentHash(): string {
        if (!this.collateralAmount) {
            throw new Error(
                MAX_LTV_LOAN_OFFER_ERRORS.COLLATERAL_AMOUNT_NOT_SET(),
            );
        }

        // We remove underwriting as a feature, since the creditor has no mechanism to mandate a maximum
        // underwriter risk rating.

        return Web3Utils.soliditySha3(
            this.data.issuanceVersion,
            this.debtor,
            NULL_ADDRESS, // underwriter
            0, // undwriter risk rating
            this.data.termsContract,
            this.termsContractParameters,
            this.data.salt,
        );
    }

    private getDebtorCommitmentHash(): string {
        // We remove underwriting as a feature, since the creditor has no mechanism to mandate a maximum
        // underwriter risk rating.

        return Web3Utils.soliditySha3(
            this.data.kernelVersion,
            this.getIssuanceCommitmentHash(),
            0, // underwriter fee
            this.data.principal.rawAmount,
            this.data.principalTokenAddress,
            this.data.debtorFee,
            this.data.creditorFee,
            this.data.relayer,
            this.data.relayerFee.rawAmount,
            this.expirationTimestampInSec,
        );
    }

    private getTermsContractParameters(): string {
        const collateral = new TokenAmount(
            this.collateralAmount,
            this.data.collateralTokenSymbol,
        );

        // Pack terms contract parameters
        const collateralizedContractTerms: CollateralizedContractTerms = {
            collateralAmount: collateral.rawAmount.toNumber(),
            collateralTokenIndex: this.data.collateralTokenIndex.toNumber(),
            gracePeriodInDays: 0,
        };

        const simpleInterestContractTerms: SimpleInterestContractTerms = {
            principalTokenIndex: this.data.principalTokenIndex.toNumber(),
            principalAmount: this.data.principal.rawAmount.toNumber(),
            interestRateFixedPoint: this.data.interestRate.raw
                .mul(FIXED_POINT_SCALING_FACTOR)
                .toNumber(),
            amortizationUnitType: this.data.termLength.getAmortizationUnitType(),
            termLengthUnits: this.data.termLength.amount,
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

        // We do not use the TokenAmount's rawValue here because what matters is the "real world" amount
        // of the principal and collateral, without regard for how many decimals are used in their
        // blockchain representations.
        const principalValue = new BigNumber(
            this.data.principal.decimalAmount,
        ).mul(this.principalPrice.value);

        const collateralValue = collateralAmount.mul(
            this.collateralPrice.value,
        );

        return principalValue
            .div(collateralValue)
            .lte(this.data.maxLTV.div(100));
    }
}
