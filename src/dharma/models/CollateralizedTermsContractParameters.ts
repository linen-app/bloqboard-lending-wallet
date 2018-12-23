import { BigNumber } from 'ethers/utils';
import { AmortizationUnit } from './UnpackedDebtOrderData';

export interface CollateralizedTermsContractParameters {
    principalAmount: BigNumber;
    interestRate: BigNumber;
    amortizationUnit: AmortizationUnit;
    termLength: BigNumber;
    principalTokenIndex: BigNumber;
    gracePeriodInDays: BigNumber;
    collateralTokenIndex: BigNumber;
    collateralAmount: BigNumber;
}

const MAX_INTEREST_RATE_PRECISION = 4;
const FIXED_POINT_SCALING_FACTOR = 10 ** MAX_INTEREST_RATE_PRECISION;

export function unpackParameters(
    packedParams: string,
): CollateralizedTermsContractParameters {

    const principalTokenIndexHex = packedParams.substr(0, 4);
    const principalAmountHex = `0x${packedParams.substr(4, 24)}`;
    const interestRateFixedPointHex = `0x${packedParams.substr(28, 6)}`;
    const amortizationUnitTypeHex = `0x${packedParams.substr(34, 1)}`;
    const termLengthHex = `0x${packedParams.substr(35, 4)}`;

    const collateralTokenIndexHex = `0x${packedParams.substr(39, 2)}`;
    const collateralAmountHex = `0x${packedParams.substr(41, 23)}`;
    const gracePeriodInDaysHex = `0x${packedParams.substr(64, 2)}`;

    // Given that our fixed point representation of the interest rate
    // is scaled up by our chosen scaling factor, we scale it down
    // for computations.
    const interestRate = new BigNumber(interestRateFixedPointHex).div(FIXED_POINT_SCALING_FACTOR);

    // Since the amortization unit type is stored in 1 byte, it can't exceed
    // a value of 255.  As such, we're not concerned about using BigNumber's
    // to represent amortization units.
    const unitCode = parseInt(amortizationUnitTypeHex, 16);
    const amortizationUnit = unitCode as AmortizationUnit;

    return {
        principalTokenIndex: new BigNumber(principalTokenIndexHex),
        principalAmount: new BigNumber(principalAmountHex),
        interestRate,
        termLength: new BigNumber(termLengthHex),
        amortizationUnit,

        collateralTokenIndex: new BigNumber(collateralTokenIndexHex),
        collateralAmount: new BigNumber(collateralAmountHex),
        gracePeriodInDays: new BigNumber(gracePeriodInDaysHex),
    };
}