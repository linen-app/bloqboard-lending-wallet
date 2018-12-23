import { Signer, utils } from 'ethers';
import { Inject, Injectable } from '@nestjs/common';
import { ECDSASignature } from './models/ECDSASignature';
import * as Web3Utils from 'web3-utils';

@Injectable()
export class MessageSigner {
    constructor(@Inject('signer') private readonly signer: Signer) { }

    async ecSign(message: string, addPrefix: boolean): Promise<ECDSASignature> {
        if (addPrefix) {
            const prefix = '\x19Ethereum Signed Message:\n32';
            message = Web3Utils.soliditySha3(prefix, message);
        }
        const messageArray = utils.arrayify(message);
        // Sign the message from the address, which returns a string.
        const creditorSignature = await this.signer.signMessage(messageArray);
        const signature = utils.splitSignature(creditorSignature);
        // Convert that signature string to its ECDSA components.
        return {
            v: signature.v,
            r: signature.r,
            s: signature.s,
        };
    }
}
