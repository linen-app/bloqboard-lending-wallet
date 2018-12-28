import { Injectable, Inject } from '@nestjs/common';
import { Binance, Account, OrderSide } from 'binance-api-node';
import { Logger } from 'winston';
import { ContractTransaction } from 'ethers';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenAmount } from '../tokens/TokenAmount';
import { TokenService } from '../tokens/TokenService';
import { InvariantViolationError } from '../errors/SmartContractInvariantViolationError';

const supportedTokens = [TokenSymbol.WETH, TokenSymbol.BAT, TokenSymbol.REP, TokenSymbol.ZRX];
const availableMarkets = supportedTokens.filter(x => x !== TokenSymbol.WETH).map(x => x + 'ETH');

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

        if (!supportedTokens.includes(tokenSymbol)) {
            throw new InvariantViolationError(`Token is not supported on Binance: ${tokenSymbol}`);
        }

        const response = await this.binanceClient.depositAddress({ asset: token.symbol });

        if (!response.success || response.asset !== tokenSymbol) {
            throw new InvariantViolationError('Error occured getting Binance deposit address');
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
            throw new InvariantViolationError(`Error occured withdrawing ${amount} from Binance: ${response.msg}`);
        }

        this.logger.info(`Withdrawing ${amount} from Binance address: ${response.msg}. id: ${response.id}`);
    }

    async sell(amountToSell: TokenAmount, tokenToBuy: TokenSymbol) {
        const { symbol, side } = this.getBinanceSymbol(amountToSell.token.symbol, tokenToBuy);

        this.logger.info(`${side} ${symbol} on Binance. Amount: ${amountToSell}`);

        const response = await this.binanceClient.order({
            symbol,
            side,
            quantity: amountToSell.humanReadableAmount.toString(),
            type: 'MARKET',
        });

        if (response.status !== 'FILLED') {
            throw new InvariantViolationError(
                `Invalid order status ${response.status} when selling ${amountToSell} for ${tokenToBuy}: ${response.status}`,
            );
        }

        this.logger.info(`Trade successful: price: ${response.price}, id: ${response.clientOrderId}`);
    }

    private getBinanceSymbol(baseToken: TokenSymbol, quoteToken: TokenSymbol): { symbol: string; side: OrderSide } {
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

        throw new InvariantViolationError(`Unsupported market: ${parsedBaseSymbol}${parsedQuoteSymbol}`);
    }
}
