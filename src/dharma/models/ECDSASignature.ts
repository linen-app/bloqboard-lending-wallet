import { ethers } from 'ethers';

export class ECDSASignature {
    r: string;
    s: string;
    v: number;

    static readonly NULL_SIGNATURE = {
        r: ethers.utils.formatBytes32String(''),
        s: ethers.utils.formatBytes32String(''),
        v: 0,
    };
}