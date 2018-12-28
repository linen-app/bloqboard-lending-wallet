import { Controller, Res, Get } from '@nestjs/common';
import { Response } from 'express-serve-static-core';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller('/')
export class RootController {
    @Get()
    @ApiExcludeEndpoint()
    redirect(@Res() res: Response) {
        res.redirect('/api');
    }
}
