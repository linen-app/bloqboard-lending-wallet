import { ECDSASignature } from './ECDSASignature';
import { Address } from '../../types';

// A price signed by the feed operator.
export interface Price {
    value: number;
    tokenAddress: Address;
    timestamp: number;
    signature: ECDSASignature;
}
