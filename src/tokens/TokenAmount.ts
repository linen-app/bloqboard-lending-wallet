import { BigNumber } from 'ethers/utils';
import { utils, ethers } from 'ethers';
import { TokenMetadata } from './TokenMetadata';
export class TokenAmount {
    private readonly amount: BigNumber;
    constructor(amount: BigNumber | string, readonly token: TokenMetadata) {
        this.amount = utils.bigNumberify(amount);
    }
    static fromHumanReadable(humanReadableAmount: number, token: TokenMetadata) {
        let amount: BigNumber;
        if (humanReadableAmount === -1) {
            amount = ethers.constants.MaxUint256;
        }
        else {
            amount = utils.parseUnits(humanReadableAmount.toString(), token.decimals);
        }
        return new TokenAmount(amount, token);
    }
    get rawAmount(): BigNumber {
        return this.amount;
    }
    get humanReadableAmount(): number {
        const amount = utils.formatUnits(this.amount, this.token.decimals);
        return Number.parseFloat(amount);
    }
    public toString(): string {
        return `${this.humanReadableAmount} ${this.token.symbol}`;
    }
}
