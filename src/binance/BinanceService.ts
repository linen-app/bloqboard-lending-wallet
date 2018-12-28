import { Injectable, Inject } from '@nestjs/common';
import { Binance, Account, OrderSide } from 'binance-api-node';
import { ContractTransaction } from 'ethers';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenAmount } from '../tokens/TokenAmount';
import { TokenService } from '../tokens/TokenService';
import { Logger } from 'winston';

@Injectable()
export class BinanceService {
    constructor(
        @Inject('binance-client') private readonly binanceClient: Binance,
        @Inject('address') private readonly address: string,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
    ) { }

    async getAccountInfo(): Promise<Account> {
        const info = await this.binanceClient.accountInfo();
        return info;
    }

    async deposit(humanReadableAmount: number, tokenSymbol: TokenSymbol): Promise<ContractTransaction> {
        const token = this.tokenService.getTokenBySymbol(tokenSymbol);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, token);
        await this.tokenService.assertTokenBalance(amount);

        const response = await this.binanceClient.depositAddress({ asset: token.symbol });
        // TODO: add check for supported tokens

        if (!response.success || response.asset !== tokenSymbol) {
            throw new Error('Error occured getting Binance deposit address');
        }

        this.logger.info(`Depositing ${amount} to binance address ${response.address}`);

        return this.tokenService.sendToken(amount, response.address);
    }

    async withdraw(amount: TokenAmount) {
        const response = await this.binanceClient.withdraw({
            asset: amount.token.symbol,
            amount: amount.humanReadableAmount,
            address: this.address,
            name: 'Bloqboard lending wallet',
        });

        if (!response.success) {
            throw new Error(`Error occured withdrawing ${amount} from Binance`);
        }

        this.logger.info(`Withdrawing ${amount} from Binance address`);
    }

    async sell(amountToSell: TokenAmount, tokenToBuy: TokenSymbol) {
        const { symbol, side } = this.getBinanceSymbol(amountToSell.token.symbol, tokenToBuy);
        const response = await this.binanceClient.order({
            symbol,
            side,
            quantity: amountToSell.humanReadableAmount.toString(),
            type: 'MARKET',
        });

        this.logger.info(`Selling ${amountToSell} for ${tokenToBuy} on Binance`);

        if (response.status !== 'FILLED') {
            throw new Error(`Invalid order status ${response.status} when selling ${amountToSell} for ${tokenToBuy}`);
        }
    }

    private getBinanceSymbol(baseToken: TokenSymbol, quoteToken: TokenSymbol): { symbol: string; side: OrderSide } {
        const availableMarkets = ['REPETH', 'BATETH', 'ZRXETH'];
        const parseSymbol = (token: TokenSymbol) => token === TokenSymbol.WETH ? 'ETH' : token;

        const parsedBaseSymbol = parseSymbol(baseToken);
        const parsedQuoteSymbol = parseSymbol(quoteToken);

        if (availableMarkets.includes(parsedBaseSymbol + parsedQuoteSymbol)) {
            return {
                symbol: parsedBaseSymbol + parsedQuoteSymbol,
                side: 'SELL',
            };
        } else if (availableMarkets.includes(parsedQuoteSymbol + parsedBaseSymbol)) {
            return {
                symbol: parsedQuoteSymbol + parsedBaseSymbol,
                side: 'BUY',
            };
        }

        throw new Error(`Unsupported market: ${parsedBaseSymbol}${parsedQuoteSymbol}`);
    }
}
