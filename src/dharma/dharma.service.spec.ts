import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { DharmaLendOffersService } from './DharmaLendOffersService';
import { DharmaDebtRequestService } from './DharmaDebtRequestService';
import * as Account from '../../resources/account.json';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { Pagination } from '../common-models/Pagination';
import { getModuleMetadata } from '../module.metadata';

describe('DharmaService', () => {
    let dharmaLendOffersService: DharmaLendOffersService;
    let dharmaDebtRequestsService: DharmaDebtRequestService;

    beforeAll(async () => {
        jest.setTimeout(120000);
        const network = 'kovan';
        const provider = ethers.getDefaultProvider(network);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const module: TestingModule = await Test.createTestingModule(getModuleMetadata(wallet, network)).compile();
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
