import { Controller, Res, Get } from '@nestjs/common';
import { Response } from 'express-serve-static-core';

@Controller('/')
export class RootController {
    @Get()
    redirect(@Res() res: Response) {
        res.redirect('/api');
    }
}
