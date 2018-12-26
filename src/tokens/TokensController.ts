import { Get, Controller, Query, HttpStatus } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TokenService } from './TokenService';
import { TokenSymbol } from './TokenSymbol';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('tokens')
@ApiUseTags('Wallet')
export class TokensController {
    constructor(
        private readonly tokenService: TokenService,
    ) { }

    @Get('balance')
    @ApiOperation({ title: 'returns token balance of the current account' })
    @ApiImplicitQuery({
        name: 'token',
        enum: supportedTokens,
        required: false,
        description: 'if a token is not specified, endpoint returns balances of all supported tokens',
    })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const promises = tokens.map(x => this.tokenService.getTokenBalance(x));
        const result = {};
        for (const amountPromise of promises) {
            const amount = await amountPromise;
            result[amount.token.symbol] = amount.humanReadableAmount;
        }
        return result;
    }
}