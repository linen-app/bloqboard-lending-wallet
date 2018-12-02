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

    async balance(tokenAddress: string): Promise<string> {
        const res = await this.moneyMarketContract.getSupplyBalance(this.wallet.address, tokenAddress);
        return utils.formatUnits(res, this.DECIMALS);
    }

    async supply(tokenAddress: string, rawAmount: string, needAwait: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.supply(tokenAddress, amount);

        if (needAwait){
            await txObject.wait();
        }

        return txObject.hash;
    }

    async withdraw(tokenAddress: string, rawAmount: string, needAwait: boolean): Promise<string> {
        const amount = utils.parseUnits(rawAmount, this.DECIMALS);
        const txObject = await this.moneyMarketContract.withdraw(tokenAddress, amount);

        if (needAwait){
            await txObject.wait();
        }

        return txObject.hash;
    }
}
