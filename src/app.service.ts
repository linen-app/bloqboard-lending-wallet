import { Injectable, Inject } from '@nestjs/common';
import { ethers, Contract, Wallet, utils } from 'ethers';
import * as Compound from '../resources/money-market.json';

@Injectable()
export class AppService {

    private readonly moneyMarketContract: Contract;
    private readonly wallet: Wallet;
    private readonly DECIMALS = 18;

    constructor(@Inject('private-key') privateKey: string) {
        const provider = ethers.getDefaultProvider('rinkeby');
        this.wallet = new ethers.Wallet(privateKey, provider);

        this.moneyMarketContract = new ethers.Contract(
            Compound.networks[4].address,
            Compound.abi,
            this.wallet,
        );
    }

    async getSupplyBalance(tokenAddress: string): Promise<string> {
        const res = await this.moneyMarketContract.getSupplyBalance(this.wallet.address, tokenAddress);
        return utils.formatUnits(res, this.DECIMALS);
    }

    async getBorrowBalance(tokenAddress: string): Promise<string> {
        const res = await this.moneyMarketContract.getBorrowBalance(this.wallet.address, tokenAddress);
        return utils.formatUnits(res, this.DECIMALS);
    }

    async getAccountLiquidity(): Promise<string> {
        const res = await this.moneyMarketContract.getAccountLiquidity(this.wallet.address);
        return utils.formatUnits(res, this.DECIMALS);
    }

    async supply(tokenAddress: string, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.supply(tokenAddress, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async withdraw(tokenAddress: string, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.withdraw(tokenAddress, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async borrow(tokenAddress: string, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.borrow(tokenAddress, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async repayBorrow(tokenAddress: string, rawAmount: string, needAwaitMining: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.repayBorrow(tokenAddress, amount);

        if (needAwaitMining){
            await txObject.wait();
        }

        return txObject.hash;
    }
}
