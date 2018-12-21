import { Address } from '../types';

export class RelayerDebtOrder {
    id: string;
    kernelAddress: Address;
    repaymentRouterAddress: Address;
    principalAmount: string;
    principalTokenAddress: Address;
    debtorAddress: Address;
    debtorFee: string;
    termsContractAddress: Address;
    termsContractParameters: string;
    expirationTime: string;
    salt: string;
    debtorSignature: string;
    relayerAddress: Address;
    relayerFee: string;
    underwriterAddress: Address;
    underwriterRiskRating: string;
    underwriterFee: string;
    underwriterSignature: string;
    creditorAddress: Address;
    creditorSignature: string;
    creditorFee: string;
    maxLtv: number;
    signerAddress: Address;
}