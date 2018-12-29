import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { CompoundService } from './CompoundService';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { utils } from 'ethers';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { TransactionLog } from '../common-models/TransactionLog';
import { Balance } from '../common-models/HumanReadableBalance';
import * as Text from '../../resources/ConstantText';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('compound')
@ApiUseTags('Compound')
export class CompoundController {
    constructor(
        private readonly compoundService: CompoundService,
    ) { }

    @Get('supply-balance')
    @ApiOperation({
        title: 'Supply balance of the connected account in Compound protocol',
        description: 'Return supplied balance of the connected account in the specified asset.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false, description: Text.SUPPORTED_TOKEND })
    @ApiResponse({ status: HttpStatus.OK, type: Balance })
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
    @ApiOperation({
        title: 'Outstanding debt of the connected account to the Compound protocol',
        description: 'Return outstanding debt of the connected account in the specified asset.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false, description: Text.SUPPORTED_TOKEND })
    @ApiResponse({ status: HttpStatus.OK, type: Balance })
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
    @ApiOperation({
        title: 'Account liquidity',
        description: 'More info: https://compound.finance/developers#get-account-liquidity' +
            '\nWARNING! Your collateral can be liquidated if your account liquidity drops below 0.',
    })
    @ApiResponse({ status: HttpStatus.OK, type: Balance })
    async accountLiquidity(): Promise<any> {
        const rawBalance = await this.compoundService.getAccountLiquidity();
        const amount = utils.formatEther(rawBalance);
        return { amount, token: 'ETH' };
    }

    @Post('supply')
    @ApiOperation({
        title: 'Supply asset',
        description: 'Supply principal as a lender or collateral as a borrower to the Compound protocol.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
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
    @ApiOperation({
        title: 'Withdraw asset',
        description: 'Withdraw principal as lender or return collateral as borrower from Compound protocol.' +
            '\nWARNING! Your collateral can be liquidated if your account liquidity drops below 0.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiImplicitQuery({ name: 'amount', description: Text.WITHDRAW_AMOUNT })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
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
    @ApiOperation({
        title: 'Borrow asset',
        description: 'Borrow asset from Compound protocol. You need to have account liquidity to cover your debt. ' +
            '\nWARNING! Your collateral can be liquidated if your account liquidity drops below 0.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
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
    @ApiOperation({
        title: 'Repay debt',
        description: 'Repay your outstanding debt to Compound protocol.',
    })
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiImplicitQuery({ name: 'amount', description: Text.REPAY_AMOUNT })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
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
