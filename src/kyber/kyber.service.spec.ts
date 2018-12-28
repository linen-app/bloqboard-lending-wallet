import { Test } from '@nestjs/testing';
import { ethers, utils } from 'ethers';
import { KyberService } from './KyberService';
import * as Kyber from '../../resources/kyber-network-proxy.json';
import * as Account from '../../resources/account.json';
import * as Tokens from '../../resources/tokens.json';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenService } from '../tokens/TokenService';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { WinstonModule } from 'nest-winston';
import { format } from 'winston';
import winston = require('winston');

describe('KyberService', () => {
    let kyberService: KyberService;

    beforeEach(async () => {
        jest.setTimeout(120000);

        const NETWORK = 'kovan';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const kyberContract = new ethers.Contract(
            Kyber.networks[NETWORK].address,
            Kyber.abi,
            wallet,
        );

        const tokens: TokenMetadata[] = Tokens.networks[NETWORK].map(x => x as TokenMetadata);
        const module = await Test.createTestingModule({
            imports: [WinstonModule.forRoot({
                transports: [
                    new winston.transports.Console({
                        format: format.combine(
                            format.colorize(),
                            format.timestamp(),
                            format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
                        ),
                    }),
                ],
            })],
            providers: [
                TokenService,
                KyberService,
                { provide: 'wallet', useValue: wallet },
                { provide: 'tokens', useValue: tokens },
                { provide: 'kyber-contract', useValue: kyberContract },
            ],
        }).compile();

        kyberService = module.get<KyberService>(KyberService);
    });

    describe('KyberService', () => {
        it('buyToken', async () => {
            const res = await kyberService.buyToken(0.0002, TokenSymbol.REP, TokenSymbol.WETH, true);
            expect(res.transactions.pop().transactionObject.hash).toBeDefined();
        });
    });
});