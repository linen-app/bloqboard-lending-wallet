import { ArgumentsHost, Catch, Inject, HttpServer, BadRequestException } from '@nestjs/common';
import { SmartContractInvariantViolationError } from '../errors/SmartContractInvariantViolationError';
import { BaseExceptionFilter, HTTP_SERVER_REF } from '@nestjs/core';

@Catch(SmartContractInvariantViolationError)
export class SmartContractInvariantViolationFilter extends BaseExceptionFilter<SmartContractInvariantViolationError> {
    constructor(@Inject(HTTP_SERVER_REF) applicationRef: HttpServer) {
        super(applicationRef);
    }

    catch(exception: SmartContractInvariantViolationError, host: ArgumentsHost) {
        super.catch(new BadRequestException(exception.message), host);
    }
}
