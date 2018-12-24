import { Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { KyberService } from './kyber.service';
import { ParseBooleanPipe } from 'src/parseBoolean.pipe';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { ParseNumberPipe } from '../parseNumber.pipe';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('kyber-network')
@ApiUseTags('Kyber Network')
export class KyberController {

    constructor(
        private readonly kyberService: KyberService,
    ) { }

    @Post('sell')
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
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
    @ApiImplicitQuery({ name: 'tokenToBuy', enum: supportedTokens })
    @ApiImplicitQuery({ name: 'tokenToSell', enum: supportedTokens })
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
