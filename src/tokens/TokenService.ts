import { Injectable, Inject } from '@nestjs/common';
import * as ERC20 from '../../resources/erc20.json';
import { Wallet, Contract, ContractTransaction, ethers } from 'ethers';
import { Address, equals } from '../types';
import { BigNumber } from 'ethers/utils';
import { Logger } from 'winston';
import { TransactionLog } from '../common-models/TransactionLog';
import { TokenSymbol } from './TokenSymbol';
import { TokenMetadata } from './TokenMetadata';
import { TokenAmount } from './TokenAmount';
import { SmartContractInvariantViolationError } from '../errors/SmartContractInvariantViolationError';

@Injectable()
export class TokenService {

    constructor(
        @Inject('tokens') private readonly tokens: TokenMetadata[],
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('winston') private readonly logger: Logger,
    ) { }

    getTokenByAddress(address: Address): TokenMetadata {
        const token = this.tokens.find(x => equals(x.address, address));

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

    async sendToken(amount: TokenAmount, beneficiary: Address, nonce?: number): Promise<ContractTransaction> {
        const token = this.getTokenBySymbol(amount.token.symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const tx: ContractTransaction = await contract.transfer(beneficiary, amount.rawAmount, { nonce });

        this.logger.info(`Transfering ${amount} to beneficiary: ${beneficiary}`);
        this.logger.info(`tx hash: ${tx.hash}`);

        return tx;
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

        const tx: ContractTransaction = await contract.approve(spender,
            ethers.constants.MaxUint256,
            { nonce, gasLimit: 90000 },
        );

        this.logger.info(`Unlocking ${symbol} for spender: ${spender}`);

        return tx;
    }

    async lockToken(symbol: TokenSymbol, spender: Address): Promise<ContractTransaction> {
        const token = this.getTokenBySymbol(symbol);
        const contract = new Contract(token.address, ERC20.abi, this.wallet);

        const tx: ContractTransaction = await contract.approve(spender, 0, { gasLimit: 50000 });

        this.logger.info(`Locking ${symbol} for spender: ${spender}`);

        return tx;
    }

    async addUnlockTransactionIfNeeded(symbol: TokenSymbol, spender: Address, transactions: TransactionLog, nonce?: number) {
        if (await this.isTokenLockedForSpender(symbol, spender)) {
            const unlockTx = await this.unlockToken(symbol, spender, nonce);
            transactions.add({ name: 'unlock', transactionObject: unlockTx });
        }
    }

    async assertTokenBalance(requiredAmount: TokenAmount) {
        const balance = await this.getTokenBalance(requiredAmount.token.symbol);
        if (requiredAmount.rawAmount.gt(balance.rawAmount)) {
            throw new SmartContractInvariantViolationError(`Token balance is too low: needed ${requiredAmount}, you have ${balance}`);
        }
    }
}