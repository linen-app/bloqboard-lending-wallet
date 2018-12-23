import { Injectable, Inject } from '@nestjs/common';
import * as ERC20 from '../../resources/erc20.json';
import { Wallet, Contract, utils, ContractTransaction, ethers } from 'ethers';
import { Address } from '../types';
import { BigNumber } from 'ethers/utils';
import { Logger } from 'winston';
import { TransactionLog } from '../TransactionLog';
import { TokenSymbol } from './TokenSymbol';
import { TokenMetadata } from './TokenMetadata';
import { TokenAmount } from './TokenAmount';

@Injectable()
export class TokenService {

    constructor(
        @Inject('tokens') private readonly tokens: TokenMetadata[],
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('winston') private readonly logger: Logger,
    ) { }

    getTokenByAddress(address: Address): TokenMetadata {
        const token = this.tokens.find(x => x.address === address);

        if (!token) throw new Error(`Token with address ${address} not found`);

        return token;
    }

    getTokenBySymbol(symbol: TokenSymbol): TokenMetadata {
        const token = this.tokens.find(x => x.symbol === symbol);

        if (!token) throw new Error(`Token with symbol ${symbol} not found`);

        return token;
    }

    getTokenSymbols(): TokenSymbol[] {
        return this.tokens.map(x => (x.symbol as TokenSymbol));
    }

    async getTokenBalance(symbol: TokenSymbol): Promise<TokenAmount> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const balance: BigNumber = await contract.balanceOf(this.wallet.address);
        return new TokenAmount(balance, token);
    }

    async isTokenLockedForSpender(symbol: TokenSymbol, spender: Address): Promise<boolean> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const allowance: BigNumber = await contract.allowance(this.wallet.address, spender);
        return allowance.eq(0);
    }

    async unlockToken(symbol: TokenSymbol, spender: Address, nonce?: number): Promise<ContractTransaction> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const tx: ContractTransaction = await contract.approve(spender, ethers.constants.MaxUint256, { nonce });

        this.logger.info(`Unlocking ${symbol} for spender: ${spender}`);

        return tx;
    }

    async lockToken(symbol: TokenSymbol, spender: Address): Promise<ContractTransaction> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const tx: ContractTransaction = await contract.approve(spender, 0);

        this.logger.info(`Locking ${symbol} for spender: ${spender}`);

        return tx;
    }

    async addUnlockTransactionIfNeeded(symbol: TokenSymbol, spender: Address, transactions: TransactionLog, nonce?: number) {
        if (await this.isTokenLockedForSpender(symbol, spender)) {
            const unlockTx = await this.unlockToken(symbol, spender, nonce);
            transactions.add({ name: 'unlock', transactionObject: unlockTx });
        }
    }
}