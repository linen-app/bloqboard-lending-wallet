import { ArgumentsHost, Catch, Inject, HttpServer, BadRequestException } from '@nestjs/common';
import { InvariantViolationError } from '../errors/SmartContractInvariantViolationError';
import { BaseExceptionFilter, HTTP_SERVER_REF } from '@nestjs/core';

@Catch(InvariantViolationError)
export class InvariantViolationFilter extends BaseExceptionFilter<InvariantViolationError> {
    constructor(@Inject(HTTP_SERVER_REF) applicationRef: HttpServer) {
        super(applicationRef);
    }

    catch(exception: InvariantViolationError, host: ArgumentsHost) {
        super.catch(new BadRequestException(exception.message), host);
    }
}
