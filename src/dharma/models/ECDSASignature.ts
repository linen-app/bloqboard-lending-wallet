import { Signer, utils, ethers } from 'ethers';
import * as Web3Utils from 'web3-utils';

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

export async function ecSign(signer: Signer, message: string, addPrefix: boolean): Promise<ECDSASignature> {

    if (addPrefix) {
        const prefix = '\x19Ethereum Signed Message:\n32';
        message = Web3Utils.soliditySha3(prefix, message);
    }

    const messageArray = utils.arrayify(message);
    // Sign the message from the address, which returns a string.
    const creditorSignature = await signer.signMessage(messageArray);

    const signature = utils.splitSignature(creditorSignature);

    // Convert that signature string to its ECDSA components.
    return {
        v: signature.v,
        r: signature.r,
        s: signature.s,
    };
}