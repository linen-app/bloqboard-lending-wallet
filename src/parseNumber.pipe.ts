import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseNumberPipe implements PipeTransform<string> {
    async transform(value: string, metadata: ArgumentMetadata): Promise<number> {

        const number = Number.parseFloat(value);
        const isNumeric =
            'string' === typeof value &&
            !Number.isNaN(number) &&
            Number.isFinite(number);

        if (!isNumeric) {
            throw new BadRequestException(
                'Validation failed (numeric string is expected)',
            );
        }
        return number;
    }
}