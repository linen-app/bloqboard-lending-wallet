export type Address = string;

export function equals(a: Address, b: Address){
    return a.toLowerCase() === b.toLowerCase();
}

export const INTEREST_RATE_SCALING_FACTOR_PERCENT = 10 ** 4;
export const INTEREST_RATE_SCALING_FACTOR_MULTIPLIER = INTEREST_RATE_SCALING_FACTOR_PERCENT * 100;