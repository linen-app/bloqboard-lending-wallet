import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { DharmaLendOffersService } from './DharmaLendOffersService';
import { DharmaDebtRequestService } from './DharmaDebtRequestService';
import { CollateralizedSimpleInterestLoanAdapter } from './CollateralizedSimpleInterestLoanAdapter';
import * as Account from '../../resources/account.json';
import * as Tokens from '../../resources/tokens.json';
import * as LtvCreditorProxyAbi from '../../resources/dharma/creditorProxyAbi.json';
import * as Addresses from '../../resources/dharma/addresses.json';
import * as BloqboardAPI from '../../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../../resources/dharma/currency-rates-api.json';
import * as ContractArtifacts from 'dharma-contract-artifacts';
import { WinstonModule } from 'nest-winston';
import winston = require('winston');
import { format } from 'winston';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenService } from '../tokens/TokenService';
import { DebtOrderWrapper } from './wrappers/DebtOrderWrapper';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { DharmaOrdersFetcher } from './DharmaOrdersFetcher';
import { MessageSigner } from './MessageSigner';
import { Pagination } from '../common-models/Pagination';
import { WINSTON_MODULE } from '../logger';

describe('DharmaService', () => {
    let dharmaLendOffersService: DharmaLendOffersService;
    let dharmaDebtRequestsService: DharmaDebtRequestService;

    beforeAll(async () => {
        jest.setTimeout(120000);
        const NETWORK = 'kovan';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const dharmaAddresses = Addresses[NETWORK];

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

        const repaymentRouterContract = new ethers.Contract(
            dharmaAddresses.RepaymentRouter,
            ContractArtifacts.latest.RepaymentRouter,
            wallet,
        );

        const collateralizedContract = new ethers.Contract(
            dharmaAddresses.Collateralizer,
            ContractArtifacts.latest.Collateralizer,
            wallet,
        );

        const ltvCreditorProxyContract = new ethers.Contract(
            dharmaAddresses.LtvCreditorProxy,
            LtvCreditorProxyAbi,
            wallet,
        );

        const tokens: TokenMetadata[] = Tokens.networks[NETWORK].map(x => x as TokenMetadata);

        const module: TestingModule = await Test.createTestingModule({
            imports: [ WINSTON_MODULE ],
            providers: [
                TokenService,
                DharmaDebtRequestService,
                DharmaLendOffersService,
                CollateralizedSimpleInterestLoanAdapter,
                DharmaOrdersFetcher,
                DebtOrderWrapper,
                MessageSigner,
                { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
                { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK] },
                { provide: 'wallet', useValue: wallet },
                { provide: 'tokens', useValue: tokens },
                { provide: 'signer', useValue: wallet },

                { provide: 'dharma-kernel-address', useValue: debtKernelContract.address },
                { provide: 'creditor-proxy-address', useValue: ltvCreditorProxyContract.address },
                { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },

                { provide: 'dharma-kernel-contract', useValue: debtKernelContract },
                { provide: 'repayment-router-contract', useValue: repaymentRouterContract },
                { provide: 'collateralizer-contract', useValue: collateralizedContract },
                { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract },
                { provide: 'ltv-creditor-proxy-contract', useValue: ltvCreditorProxyContract },
            ],
        }).compile();
        dharmaLendOffersService = module.get<DharmaLendOffersService>(DharmaLendOffersService);
        dharmaDebtRequestsService = module.get<DharmaDebtRequestService>(DharmaDebtRequestService);
    });

    it('should be defined', () => {
        expect(dharmaLendOffersService).toBeDefined();
        expect(dharmaDebtRequestsService).toBeDefined();
    });

    it('should get and fill lend offer', async () => {
        const res: any[] = await dharmaLendOffersService.getLendOffers(Pagination.default, TokenSymbol.WETH, TokenSymbol.ZRX, 0, 5);
        expect(res.length).toBeGreaterThan(0);

        const tx = await dharmaLendOffersService.fillLendOffer(res[0].id, true);
        expect(tx.transactions.pop().transactionObject.hash).toBeTruthy();
    });

    it('should get and fill debt request', async () => {
        const res: any[] = await dharmaDebtRequestsService.getDebtOrders(Pagination.default, TokenSymbol.WETH, TokenSymbol.ZRX, 0, 5);
        expect(res.length).toBeGreaterThan(0);

        const tx = await dharmaDebtRequestsService.fillDebtRequest(res[0].id, true);
        expect(tx.transactions.pop().transactionObject.hash).toBeTruthy();
    });
});
