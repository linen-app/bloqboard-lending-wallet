import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { TransactionLog } from '../common-models/TransactionLog';
import * as Text from '../../resources/ConstantText';
import { MakerDaoService } from './MakerDaoService';

@Controller('makerdao')
@ApiUseTags('Maker DAO')
export class MakerDaoController {
    constructor(
        private readonly makerDaoService: MakerDaoService,
    ) { }

    @Get('cdps')
    @ApiOperation({ title: 'Return MakerDAO CDPs of the current account' })
    @ApiResponse({ status: HttpStatus.OK })
    async cdps(): Promise<any> {
        return this.makerDaoService.getCdps();
    }

    @Get('cdpInfo')
    @ApiOperation({ title: 'Return info about specified MakerDAO CDP' })
    @ApiResponse({ status: HttpStatus.OK })
    async cdpInfo(@Query('cdpId') cdpId: string): Promise<any> {
        return this.makerDaoService.getCdpInfo(cdpId);
    }

    @Post('supply-and-borrow')
    @ApiOperation({ title: 'Supply WETH and borrow DAI'})
    @ApiImplicitQuery({ name: 'cdpId', required: false, description: '' })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async supply(
        @Query('cdpId') cdpId: string,
        @Query('wethAmount', ParseNumberPipe) wethAmount: number,
        @Query('daiAmount', ParseNumberPipe) daiAmount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.makerDaoService.supplyAndBorrow(cdpId, wethAmount, daiAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('repay-and-withdraw')
    @ApiOperation({ title: 'Repay DAI and withdraw WETH'})
    @ApiImplicitQuery({ name: 'cdpId', required: false, description: '' })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async repayAndWithdraw(
        @Query('cdpId') cdpId: string,
        @Query('wethAmount', ParseNumberPipe) wethAmount: number,
        @Query('daiAmount', ParseNumberPipe) daiAmount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.makerDaoService.repayAndWithdraw(cdpId, wethAmount, daiAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
