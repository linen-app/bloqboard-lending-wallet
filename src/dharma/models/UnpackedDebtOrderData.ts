import { DebtOrderData } from './DebtOrderData';
import { TokenAmount } from '../../tokens/TokenAmount';
import { BigNumber } from 'ethers/utils';

export enum AmortizationUnit {
    HOURS,
    DAYS,
    WEEKS,
    MONTHS,
    YEARS,
}

export interface UnpackedDebtOrderData extends DebtOrderData {
    interestRate: BigNumber;
    amortizationUnit: AmortizationUnit;
    termLength: BigNumber;
    gracePeriodInDays: BigNumber;
    collateral: TokenAmount;
    principalTokenIndex: BigNumber;
    collateralTokenIndex: BigNumber;
}
