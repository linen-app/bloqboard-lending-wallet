import { BigNumber } from 'bignumber.js';

export class InterestRate {
    public static fromRaw(value: BigNumber): InterestRate {
        return new InterestRate(value.toNumber());
    }

    public readonly percent: number;
    public readonly raw: BigNumber;

    constructor(value: number) {
        this.percent = value;
        this.raw = new BigNumber(value);
    }
}
