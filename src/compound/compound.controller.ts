import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { CompoundService } from './compound.service';
import { TokenService } from '../tokens/TokenService';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { utils } from 'ethers';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { ParseNumberPipe } from '../parseNumber.pipe';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('compound')
@ApiUseTags('Compound')
export class CompoundController {
    constructor(
        private readonly compoundService: CompoundService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('token-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.tokenService.getTokenBalance(t);
            result[t] = rawBalance.humanReadableAmount;
        }
        return result;
    }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async supplyBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.compoundService.getSupplyBalance(t);
            result[t] = rawBalance.humanReadableAmount;
        }
        return result;
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async borrowBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.compoundService.getBorrowBalance(t);
            result[t] = rawBalance.humanReadableAmount;
        }
        return result;
    }

    @Get('account-liquidity')
    async accountLiquidity(): Promise<any> {
        const rawBalance = await this.compoundService.getAccountLiquidity();
        const amount = utils.formatEther(rawBalance);
        return { amount, token: 'ETH' };
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async supply(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.compoundService.supply(token, amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async withdraw(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.compoundService.withdraw(token, amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('borrow')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async borrow(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.compoundService.borrow(token, amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('repay-borrow')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async repayBorrow(
        @Query('token') token: TokenSymbol,
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('utilizeOtherTokens', ParseBooleanPipe) utilizeOtherTokens: boolean,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.compoundService.repayBorrow(token, amount, utilizeOtherTokens, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
