import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ParseNullableNumberPipe implements PipeTransform<string> {
    async transform(value: string, metadata: ArgumentMetadata): Promise<number> {

        const number = Number.parseFloat(value);
        const isNumeric =
            'string' === typeof value &&
            !Number.isNaN(number) &&
            Number.isFinite(number);

        if (!isNumeric) {
            return null;
        }
        return number;
    }
}