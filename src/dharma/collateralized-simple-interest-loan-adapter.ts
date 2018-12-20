import { Inject, Injectable } from '@nestjs/common';
import { Contract } from 'ethers';
import { BigNumber } from 'dharma-max-ltv-fork/build/js/typescript/utils';

type AmortizationUnit = 'hours' | 'days' | 'weeks' | 'months' | 'years';

enum AmortizationUnitCode {
    HOURS,
    DAYS,
    WEEKS,
    MONTHS,
    YEARS,
}

interface ECDSASignature {
    r: string;
    s: string;
    v: number;
}

interface DebtOrderData {
    kernelVersion?: string;
    issuanceVersion?: string;
    principalAmount?: BigNumber;
    principalToken?: string;
    debtor?: string;
    debtorFee?: BigNumber;
    creditor?: string;
    creditorFee?: BigNumber;
    relayer?: string;
    relayerFee?: BigNumber;
    underwriter?: string;
    underwriterFee?: BigNumber;
    underwriterRiskRating?: BigNumber;
    termsContract?: string;
    termsContractParameters?: string;
    expirationTimestampInSec?: BigNumber;
    salt?: BigNumber;

    // Signatures
    debtorSignature?: ECDSASignature;
    creditorSignature?: ECDSASignature;
    underwriterSignature?: ECDSASignature;
}

interface SimpleInterestLoanOrder extends DebtOrderData {
    // Required Debt Order Parameters
    principalAmount: BigNumber;
    principalTokenSymbol: string;
    principalTokenAddress: string;
    principalTokenIndex: BigNumber;

    // Parameters for Terms Contract
    interestRate: BigNumber;
    amortizationUnit: AmortizationUnit;
    termLength: BigNumber;
}

interface SimpleInterestTermsContractParameters {
    principalAmount: BigNumber;
    interestRate: BigNumber;
    amortizationUnit: AmortizationUnit;
    termLength: BigNumber;
    principalTokenIndex: BigNumber;
}

// Extend order to include parameters necessary for a collateralized terms contract.
interface CollateralizedSimpleInterestLoanOrder extends SimpleInterestLoanOrder {
    collateralTokenSymbol: string;
    collateralTokenAddress: string;
    collateralTokenIndex: BigNumber;
    collateralAmount: BigNumber;
    gracePeriodInDays: BigNumber;
}

interface CollateralizedTermsContractParameters {
    collateralTokenIndex: BigNumber;
    collateralAmount: BigNumber;
    gracePeriodInDays: BigNumber;
}

interface CollateralizedSimpleInterestTermsContractParameters
    extends SimpleInterestTermsContractParameters,
    CollateralizedTermsContractParameters { }

@Injectable()
export class CollateralizedSimpleInterestLoanAdapter {

    public constructor(
        @Inject('dharma-token-registry-contract') private readonly dharmaTokenRegistry: Contract,
    ) { }

    async fromDebtOrder(
        debtOrderData: DebtOrderData,
    ): Promise<CollateralizedSimpleInterestLoanOrder> {

        const { principalTokenIndex, collateralTokenIndex, ...params } = this.unpackParameters(
            debtOrderData.termsContractParameters,
        );

        const principalTokenSymbol = await this.dharmaTokenRegistry.getTokenSymbolByIndex(
            principalTokenIndex.toNumber(),
        );

        const principalTokenAddress = await this.dharmaTokenRegistry.getTokenAddressByIndex(
            principalTokenIndex.toNumber(),
        );

        const collateralTokenSymbol = await this.dharmaTokenRegistry.getTokenSymbolByIndex(
            collateralTokenIndex.toNumber(),
        );

        const collateralTokenAddress = await this.dharmaTokenRegistry.getTokenAddressByIndex(
            collateralTokenIndex.toNumber(),
        );

        return {
            ...debtOrderData,
            principalTokenSymbol,
            principalTokenAddress,
            principalTokenIndex,
            collateralTokenSymbol,
            collateralTokenAddress,
            collateralTokenIndex,
            ...params,
        };
    }

    private unpackParameters(
        termsContractParameters: string,
    ): CollateralizedSimpleInterestTermsContractParameters {
        const simpleInterestParams = this.unpackSimpleInterestParameters(
            termsContractParameters,
        );

        const collateralizedParams = this.unpackCollateralizedParameters(
            termsContractParameters,
        );

        return {
            ...simpleInterestParams,
            ...collateralizedParams,
        };
    }

    private unpackSimpleInterestParameters(
        termsContractParametersPacked: string,
    ): SimpleInterestTermsContractParameters {
        const MAX_INTEREST_RATE_PRECISION = 4;
        const FIXED_POINT_SCALING_FACTOR = 10 ** MAX_INTEREST_RATE_PRECISION;

        const principalTokenIndexHex = termsContractParametersPacked.substr(0, 4);
        const principalAmountHex = `0x${termsContractParametersPacked.substr(4, 24)}`;
        const interestRateFixedPointHex = `0x${termsContractParametersPacked.substr(28, 6)}`;
        const amortizationUnitTypeHex = `0x${termsContractParametersPacked.substr(34, 1)}`;
        const termLengthHex = `0x${termsContractParametersPacked.substr(35, 4)}`;

        const principalTokenIndex = new BigNumber(principalTokenIndexHex);
        const principalAmount = new BigNumber(principalAmountHex);
        const interestRateFixedPoint = new BigNumber(interestRateFixedPointHex);
        const termLength = new BigNumber(termLengthHex);

        // Given that our fixed point representation of the interest rate
        // is scaled up by our chosen scaling factor, we scale it down
        // for computations.
        const interestRate = interestRateFixedPoint.div(FIXED_POINT_SCALING_FACTOR);

        // Since the amortization unit type is stored in 1 byte, it can't exceed
        // a value of 255.  As such, we're not concerned about using BigNumber's
        // to represent amortization units.
        const unitCode = parseInt(amortizationUnitTypeHex, 16);

        const amortizationUnit = AmortizationUnitCode[unitCode].toLowerCase() as AmortizationUnit;

        return {
            principalTokenIndex,
            principalAmount,
            interestRate,
            termLength,
            amortizationUnit,
        };
    }

    private unpackCollateralizedParameters(packedParams: string): CollateralizedTermsContractParameters {
        const collateralTokenIndexHex = `0x${packedParams.substr(39, 2)}`;
        const collateralAmountHex = `0x${packedParams.substr(41, 23)}`;
        const gracePeriodInDaysHex = `0x${packedParams.substr(64, 2)}`;

        return {
            collateralTokenIndex: new BigNumber(collateralTokenIndexHex),
            collateralAmount: new BigNumber(collateralAmountHex),
            gracePeriodInDays: new BigNumber(gracePeriodInDaysHex),
        };
    }
}