import { BigNumber } from 'bignumber.js';

export interface SimpleInterestContractTerms {
    principalTokenIndex: number;
    principalAmount: string;
    interestRateFixedPoint: number;
    amortizationUnitType: number;
    termLengthUnits: number;
}

export interface CollateralizedContractTerms {
    collateralTokenIndex: number;
    collateralAmount: string;
    gracePeriodInDays: number;
}

export class CollateralizedSimpleInterestTermsParameters {
    public static bitShiftLeft(target: number | string, numPlaces: number): BigNumber {
        const binaryTargetString = new BigNumber(target).toString(2);
        const binaryTargetStringShifted = binaryTargetString + '0'.repeat(numPlaces);

        return new BigNumber(binaryTargetStringShifted, 2);
    }

    public static pack(
        collateralTerms: CollateralizedContractTerms,
        // Optionally, get the full contract terms parameters string by providing the contract terms.
        contractTerms?: SimpleInterestContractTerms,
    ): string {

        const principalTokenIndexShifted = this.bitShiftLeft(contractTerms.principalTokenIndex, 248);

        const principalAmountShifted = this.bitShiftLeft(contractTerms.principalAmount, 152);

        const interestRateShifted = this.bitShiftLeft(contractTerms.interestRateFixedPoint, 128);

        const amortizationUnitTypeShifted = this.bitShiftLeft(contractTerms.amortizationUnitType, 124);
        const termLengthShifted = this.bitShiftLeft(contractTerms.termLengthUnits, 108);

        const baseTenParameters = principalTokenIndexShifted
            .plus(principalAmountShifted)
            .plus(interestRateShifted)
            .plus(amortizationUnitTypeShifted)
            .plus(termLengthShifted);

        const packedTermsParameters =  `0x${baseTenParameters.toString(16).padStart(64, '0')}`;

        const encodedCollateralToken = collateralTerms.collateralTokenIndex.toString(16).padStart(2, '0');
        const encodedCollateralAmount = new BigNumber(collateralTerms.collateralAmount).toString(16).padStart(23, '0');
        const encodedGracePeriodInDays = collateralTerms.gracePeriodInDays.toString(16).padStart(2, '0');

        const packedCollateralParameters = encodedCollateralToken + encodedCollateralAmount + encodedGracePeriodInDays;

        if (contractTerms) {
            return `${packedTermsParameters.substr(0, 39)}${packedCollateralParameters.padStart(27, '0')}`;
        } else {
            return `0x${packedCollateralParameters.padStart(64, '0')}`;
        }
    }
}
