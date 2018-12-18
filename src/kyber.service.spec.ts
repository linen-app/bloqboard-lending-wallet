import { Test } from '@nestjs/testing';
import { TokenService } from './token.service';
import { ethers, utils } from 'ethers';
import { TokenMetadata, TokenSymbol } from './types';
import { KyberService } from './kyber.service';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Account from '../resources/account.json';
import * as Tokens from '../resources/tokens.json';

describe('KyberService', () => {
    let kyberService: KyberService;

    beforeEach(async () => {
        jest.setTimeout(420000);

        const provider = ethers.getDefaultProvider('rinkeby');
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const kyberContract = new ethers.Contract(
            Kyber.networks[4].address,
            Kyber.abi,
            wallet,
        );

        const tokens: TokenMetadata[] = Tokens.networks[4];
        const module = await Test.createTestingModule({
            providers: [
                TokenService,
                KyberService,
                {
                    provide: 'wallet',
                    useValue: wallet,
                },
                {
                    provide: 'tokens',
                    useValue: tokens,
                },
                {
                    provide: 'kyber-contract',
                    useValue: kyberContract,
                },
            ],
        }).compile();

        kyberService = module.get<KyberService>(KyberService);
    });

    describe('KyberService', () => {
        it('buyToken', async () => {
            const res = await kyberService.buyToken(utils.parseEther('0.2'), TokenSymbol.DAI, TokenSymbol.WETH, true);
        });
    });
});