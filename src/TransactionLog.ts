import { ContractTransaction } from 'ethers';

export interface TransactionLogEntry {
    name: string;
    transactionObject: ContractTransaction;
}

export class TransactionLog {
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