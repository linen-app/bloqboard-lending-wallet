import { Test } from '@nestjs/testing';
import { ethers, utils } from 'ethers';
import { KyberService } from './kyber.service';
import * as Kyber from '../../resources/kyber-network-proxy.json';
import * as Account from '../../resources/account.json';
import * as Tokens from '../../resources/tokens.json';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenService } from '../tokens/TokenService';
import { TokenSymbol } from '../tokens/TokenSymbol';

describe('KyberService', () => {
    let kyberService: KyberService;

    beforeEach(async () => {
        jest.setTimeout(120000);

        const provider = ethers.getDefaultProvider('mainnet');
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const kyberContract = new ethers.Contract(
            Kyber.networks.mainnet.address,
            Kyber.abi,
            wallet,
        );

        const tokens: TokenMetadata[] = Tokens.networks.mainnet;
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
            const res = await kyberService.buyToken(0.2, TokenSymbol.DAI, TokenSymbol.WETH, true);
        });
    });
});