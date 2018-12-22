import { ECDSASignature } from './ECDSASignature';

export interface DebtOrder {
    kernelVersion: string;
    issuanceVersion: string;
    principalAmount: number | string;
    principalToken: string;
    collateralAmount: number | string;
    collateralToken: string;
    debtor: string;
    debtorFee: number | string;
    creditor: string;
    creditorFee: number | string;
    relayer: string;
    relayerFee: number | string;
    underwriter: string;
    underwriterFee: number | string;
    underwriterRiskRating: number | string;
    termsContract: string;
    termsContractParameters: string;
    expirationTimestampInSec: number | string;
    salt: number | string;
    debtorSignature: ECDSASignature;
    creditorSignature: ECDSASignature;
    underwriterSignature: ECDSASignature;
}

// The set of values that the creditor signs.
export interface CommitmentValues {
    maxLTV: number | string;
    // The price feed operator's address .
    priceFeedOperator: string;
}

// The combination of signed values and signature .
export interface CreditorCommitment {
    values: CommitmentValues;
    signature: ECDSASignature;
}

// A price signed by the feed operator.
export interface Price {
    value: number;
    tokenAddress: string;
    timestamp: number;
    signature: ECDSASignature;
}

// The parameters that must be passed to the proxy contract.
export interface LTVParams {
    // The creditor's address.
    creditor: string;

    // The values and signature for the creditor commitment hash.
    creditorCommitment: CreditorCommitment;
    // Price feed data.
    principalPrice: Price;
    collateralPrice: Price;
    // A DebtOrderData is required to confirm parity with the submitted order.
    order: DebtOrder;
}
