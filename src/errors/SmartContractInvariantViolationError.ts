export class InvariantViolationError extends Error {
    constructor(message: string){
        super(message);
    }
}