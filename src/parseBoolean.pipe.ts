import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseBooleanPipe implements PipeTransform<string> {
    async transform(value: string, metadata: ArgumentMetadata): Promise<boolean> {
        if (!value) return undefined;

        const isBoolean =
            'string' === typeof value &&
            (value === 'false' || value === 'true');
        if (!isBoolean) {
            throw new BadRequestException(
                'Validation failed (boolean is expected)',
            );
        }
        return JSON.parse(value);
    }
}