import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { BinanceService } from './BinanceService';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { utils } from 'ethers';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { TransactionLog } from '../common-models/TransactionLog';
import { Balance } from '../common-models/HumanReadableBalance';
import * as Text from '../../resources/ConstantText';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

/*
#TODO:
- Make PR with typings
- Wrap/unwrap ETH for transferring to binance
- Deposit/withdrawal history
- Check for min order amount
- in case of binance Error, respond with error message
*/

@Controller('binance')
@ApiUseTags('Binance')
export class BinanceController {
    constructor(
        private readonly binanceService: BinanceService,
    ) { }

    @Get('account-info')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiResponse({ status: HttpStatus.OK })
    async accountInfo(): Promise<any> {
        const result = await this.binanceService.getAccountInfo();

        return result;
    }

    @Get('deposit-history')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiResponse({ status: HttpStatus.OK })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, description: Text.SUPPORTED_TOKEND })
    async depositHistory(@Query('token') token: TokenSymbol): Promise<any> {
        const result = await this.binanceService.getDepositHistory(token);

        return result;
    }

    @Get('withdrawal-history')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiResponse({ status: HttpStatus.OK })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, description: Text.SUPPORTED_TOKEND })
    async withdrawHistory(@Query('token') token: TokenSymbol): Promise<any> {
        const result = await this.binanceService.getWithdrawHistory(token);

        return result;
    }

    @Post('deposit')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async deposit(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.binanceService.deposit(amount, token, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('withdraw')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async withdraw(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Res() res,
    ): Promise<string> {
        const result = await this.binanceService.withdraw(amount, token);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('sell')
    @ApiOperation({
        title: '',
        description: '',
    })
    @ApiResponse({ status: HttpStatus.CREATED })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    async sell(
        @Query('amountToSell', ParseNumberPipe) amountToSell: number,
        @Query('tokenToSell') tokenToSell: TokenSymbol,
        @Query('tokenToBuy') tokenToBuy: TokenSymbol,
        @Res() res,
    ): Promise<string> {
        const result = await this.binanceService.sell(amountToSell, tokenToSell, tokenToBuy);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
