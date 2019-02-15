import { Test } from '@nestjs/testing';
import { ethers } from 'ethers';
import { KyberService } from './KyberService';
import * as Kyber from '../../resources/kyber-network-proxy.json';
import * as Account from '../../resources/account.json';
import { TokenService } from '../tokens/TokenService';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { getModuleMetadata } from '../module.metadata';

describe('KyberService', () => {
    let kyberService: KyberService;
    let tokenService: TokenService;
    const network = 'mainnet';

    beforeEach(async () => {
        jest.setTimeout(120000);

        const provider = ethers.getDefaultProvider(network);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);
        const module = await Test.createTestingModule(getModuleMetadata(wallet, network)).compile();

        kyberService = module.get<KyberService>(KyberService);
        tokenService = module.get<TokenService>(TokenService);
    });

    describe('KyberService', () => {
        it('buyToken', async () => {
            await (await tokenService.lockToken(TokenSymbol.WETH, Kyber.networks[network].address)).wait();
            const res = await kyberService.buyToken(0.0002, TokenSymbol.REP, TokenSymbol.WETH, true);
            expect(res.transactions.pop().transactionObject.hash).toBeDefined();
        });
    });
});