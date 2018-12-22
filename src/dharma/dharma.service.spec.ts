import { Test, TestingModule } from '@nestjs/testing';
import { DharmaService } from './dharma.service';
import { ethers } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './collateralized-simple-interest-loan-adapter';
import * as Account from '../../resources/account.json';
import * as Tokens from '../../resources/tokens.json';
import * as CreditorProxy from '../../resources/dharma/creditor-proxy.json';
import * as BloqboardAPI from '../../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../../resources/dharma/currency-rates-api.json';
import * as ContractArtifacts from 'dharma-contract-artifacts';
import * as DharmaAddressBook from 'dharma-address-book';
import { WinstonModule } from 'nest-winston';
import winston = require('winston');
import { format } from 'winston';
import { TokenService } from '../token.service';
import { TokenMetadata, TokenSymbol } from '../types';

describe('DharmaService', () => {
    let service: DharmaService;

    beforeAll(async () => {
        jest.setTimeout(120000);
        const NETWORK = 'mainnet';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const dharmaAddresses = DharmaAddressBook.latest[NETWORK === 'mainnet' ? 'live' : NETWORK];

        const tokenRegistryContract = new ethers.Contract(
            dharmaAddresses.TokenRegistry,
            ContractArtifacts.latest.TokenRegistry,
            wallet,
        );

        const debtKernelContract = new ethers.Contract(
            dharmaAddresses.DebtKernel,
            ContractArtifacts.latest.DebtKernel,
            wallet,
        );

        const tokens: TokenMetadata[] = Tokens.networks[NETWORK];

        const module: TestingModule = await Test.createTestingModule({
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
                DharmaService,
                TokenService,
                CollateralizedSimpleInterestLoanAdapter,
                { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
                { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK]},
                { provide: 'dharma-kernel-contract', useValue: debtKernelContract },
                { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },
                { provide: 'creditor-proxy-address', useValue: CreditorProxy.networks[NETWORK].address },
                { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract},
                { provide: 'wallet', useValue: wallet },
                { provide: 'tokens', useValue: tokens },
            ],
        }).compile();
        service = module.get<DharmaService>(DharmaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should be able to get offers', async () => {
        const res = await service.getLendOffers(TokenSymbol.WETH, TokenSymbol.DAI, 0, 5);
        expect(res.length).toBeGreaterThan(0);
    });

    xit('should fill lend offer', async () => {
        const tx = await service.fillLendOffer('0x52f39ab2d36b295cb02af4a13089842cf61a4ea771357a08d749c22f4bf6073e', false);
        expect(tx.transactions.pop().transactionObject.hash).toBeTruthy();
    });

    it('should fill debt request', async () => {
        const tx = await service.fillDebtRequest('0x32ba307cb3d3bf2840c1119f5846c05933a985d4731a91164370252cb94f7aa0', false);
        expect(tx.transactions.pop().transactionObject.hash).toBeTruthy();
    });
});
