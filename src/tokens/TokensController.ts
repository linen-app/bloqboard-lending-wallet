import { Get, Controller, Query } from '@nestjs/common';
import { TokenService } from './TokenService';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { TokenSymbol } from './TokenSymbol';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('tokens')
@ApiUseTags('Wallet')
export class TokensController {
    constructor(
        private readonly tokenService: TokenService,
    ) { }

    @Get('balance')
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
}
