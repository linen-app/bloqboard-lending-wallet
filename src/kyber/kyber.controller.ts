import { Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { TokenSymbol } from 'src/types';
import { KyberService } from './kyber.service';
import { TokenService } from 'src/token.service';
import { ParseBooleanPipe } from 'src/parseBoolean.pipe';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('kyber-network')
@ApiUseTags('Kyber Network')
export class KyberController {

    constructor(
        private readonly kyberService: KyberService,
        private readonly tokenService: TokenService,
    ) { }

    @Post('buy')
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    async supply(
        @Query('amountToBuy') amountToBuy: string,
        @Query('tokenToBuy') tokenToBuy: TokenSymbol,
        @Query('tokenToSell') tokenToSell: TokenSymbol,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amountToBuy, tokenToBuy);
        const result = await this.kyberService.buyToken(rawAmount, tokenToBuy, tokenToSell, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
