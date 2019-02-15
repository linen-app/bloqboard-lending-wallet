import { ECDSASignature } from './ECDSASignature';
import { Address } from '../../types';
import { TokenAmount } from '../../tokens/TokenAmount';
import { BigNumber } from 'ethers/utils';

export interface DebtOrderData {
    kernelVersion: Address;
    issuanceVersion: Address;
    principal: TokenAmount;
    debtor: Address;
    debtorFee: TokenAmount;
    creditor: Address;
    creditorFee: TokenAmount;
    relayer: Address;
    relayerFee: TokenAmount;
    underwriter: Address;
    underwriterFee: TokenAmount;
    underwriterRiskRating: BigNumber;
    termsContract: Address;
    termsContractParameters: string;
    expirationTimestampInSec: BigNumber;
    salt: BigNumber;
    // Signatures
    debtorSignature: ECDSASignature;
    creditorSignature: ECDSASignature;
    underwriterSignature: ECDSASignature;

    // Lend Offer fields
    maxLtv: number;
    priceProvider: Address;
}