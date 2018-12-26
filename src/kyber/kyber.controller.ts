import { Controller, Post, Query, Res, HttpStatus, Get } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KyberService } from './kyber.service';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { TransactionLog } from '../TransactionLog';
import * as Text from '../../resources/ConstantText';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('kyber-network')
@ApiUseTags('Kyber Network')
export class KyberController {

    constructor(
        private readonly kyberService: KyberService,
    ) { }

    @Get('exchange-rate')
    @ApiOperation({
        title: 'Get exchange rate',
        description: 'Exchange rate provided by Kyber exchange. Returned value is an exchange rate for tokenToBuy/tokenToSell',
    })
    @ApiImplicitQuery({ name: 'amountToBuy', description: 'this amount is used by Kyber smart contract to determine exchange rate more precisely' })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    async getExchangeRate(
        @Query('amountToBuy', ParseNumberPipe) amountToSell: number,
        @Query('tokenToSell') tokenToSell: TokenSymbol,
        @Query('tokenToBuy') tokenToBuy: TokenSymbol,
    ): Promise<number> {
        const result = await this.kyberService.getSlippageRate(amountToSell, tokenToSell, tokenToBuy);

        return result;
    }

    @Post('sell')
    @ApiOperation({
        title: 'Sell token',
        description: 'Convert specified of tokenToSell to tokenToBuy. Exchange rate will be provided by Kyber exchange.',
    })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', description: Text.NEED_AWAIT_MINING, })
    async sell(
        @Query('amountToSell', ParseNumberPipe) amountToSell: number,
        @Query('tokenToSell') tokenToSell: TokenSymbol,
        @Query('tokenToBuy') tokenToBuy: TokenSymbol,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.kyberService.sellToken(amountToSell, tokenToSell, tokenToBuy, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('buy')
    @ApiOperation({
        title: 'Buy token',
        description: 'Convert tokenToSell to specified amount of tokenToBuy. Exchange rate will be provided by Kyber exchange.',
    })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', description: Text.NEED_AWAIT_MINING })
    async buy(
        @Query('amountToBuy', ParseNumberPipe) amountToBuy: number,
        @Query('tokenToBuy') tokenToBuy: TokenSymbol,
        @Query('tokenToSell') tokenToSell: TokenSymbol,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.kyberService.buyToken(amountToBuy, tokenToBuy, tokenToSell, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
