import { ApiModelProperty } from '@nestjs/swagger';
import { BigNumber } from 'ethers/utils';
import { ContractTransaction } from 'ethers';

export class TransactionResponse {
    @ApiModelProperty()
    hash?: string;

    @ApiModelProperty()
    to?: string;

    @ApiModelProperty()
    from: string;

    @ApiModelProperty()
    nonce: number;

    @ApiModelProperty()
    gasLimit: BigNumber;

    @ApiModelProperty()
    gasPrice: BigNumber;

    @ApiModelProperty()
    data: string;

    @ApiModelProperty()
    value: BigNumber;

    @ApiModelProperty()
    chainId: number;

    @ApiModelProperty()
    r?: string;

    @ApiModelProperty()
    s?: string;

    @ApiModelProperty()
    v?: number;

    @ApiModelProperty()
    blockNumber?: number;

    @ApiModelProperty()
    blockHash?: string;

    @ApiModelProperty()
    timestamp?: number;

    @ApiModelProperty()
    confirmations: number;

    @ApiModelProperty()
    raw?: string;
}

export class TransactionLogEntry {
    @ApiModelProperty()
    name: string;

    @ApiModelProperty({type: TransactionResponse})
    transactionObject: ContractTransaction;
}

export class TransactionLog {
    @ApiModelProperty({ isArray: true, type: TransactionLogEntry })
    public readonly transactions: TransactionLogEntry[] = [];

    constructor(txs?: TransactionLogEntry[]) {
        if (!txs) return;

        for (const tx of txs) {
            this.add(tx);
        }
    }

    combine(other: TransactionLog) {
        if (!other) return;

        for (const tx of other.transactions) {
            this.add(tx);
        }
    }

    add(tx: TransactionLogEntry) {
        if (tx && tx.transactionObject) {
            this.transactions.push(tx);
        }
    }

    async wait() {
        for (const tx of this.transactions) {
            await tx.transactionObject.wait();
        }
    }

    getNextNonce() {
        if (this.transactions.length === 0) {
            return null;
        }

        const maxNonce = this.transactions.reduce((max, x) => Math.max(max, x.transactionObject.nonce), 0);
        return maxNonce + 1;
    }
}