export type Address = string;

export function equals(a: Address, b: Address){
    return a.toLowerCase() === b.toLowerCase();
}