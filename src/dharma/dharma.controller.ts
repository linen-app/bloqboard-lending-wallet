import { Get, Controller, Post, Query, Res, HttpStatus, ParseIntPipe, Param } from '@nestjs/common';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { DharmaService } from './dharma.service';
import { ApiImplicitQuery } from '@nestjs/swagger';

@Controller('dharma')
export class DharmaController {
    constructor(
        private readonly dharmaService: DharmaService,
    ) { }

    @Get('lend-offers')
    async getLendOffers(
        @Query('minUsdAmount', ParseIntPipe) minUsdAmount: number,
        @Query('maxUsdAmount', ParseIntPipe) maxUsdAmount: number,
    ): Promise<any> {
        const offers = await this.dharmaService.getLendOffers(null, null, minUsdAmount, maxUsdAmount);

        return offers;
    }

    @Post('fill-lend-offer/:lendOfferId')
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false })
    async fillLendOffer(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaService.fillLendOffer(lendOfferId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
