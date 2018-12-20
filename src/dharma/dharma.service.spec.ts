import { Test, TestingModule } from '@nestjs/testing';
import { DharmaService } from './dharma.service';
import { ethers } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './collateralized-simple-interest-loan-adapter';
import * as Account from '../../resources/account.json';
import * as DebtKerenel from '../../resources/dharma/debt-kernel.json';
import * as CreditorProxy from '../../resources/dharma/creditor-proxy.json';
import * as BloqboardAPI from '../../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../../resources/dharma/currency-rates-api.json';
import * as DharmaTokenRegistry from '../../resources/dharma/dharma-token-registry.json';

describe('DharmaService', () => {
    let service: DharmaService;

    beforeAll(async () => {
        jest.setTimeout(120000);
        const NETWORK = 'mainnet';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const tokenRegistryContract = new ethers.Contract(
            DharmaTokenRegistry.networks[NETWORK].address,
            DharmaTokenRegistry.abi,
            wallet,
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DharmaService,
                CollateralizedSimpleInterestLoanAdapter,
                { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
                { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK]},
                { provide: 'dharma-kernel-address', useValue: DebtKerenel.networks[NETWORK] },
                { provide: 'creditor-proxy-address', useValue: CreditorProxy.networks[NETWORK].address },
                { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract},
                { provide: 'wallet', useValue: wallet },
            ],
        }).compile();
        service = module.get<DharmaService>(DharmaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should fill lend offer', async () => {
        const lendOffers = await service.getLendOffers();
        await service.fillLendOffer('0xdad356e61d304b2cc919a9f1ae2792b38a9e215cc8ec7a9f7d2992d3a0c21e8d'); // lendOffers[0].id);
    });
});
