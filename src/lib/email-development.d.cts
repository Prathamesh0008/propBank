export function address(value: unknown): string | null;
export function developmentEmailConfiguration(env: Record<string,string|undefined>): {mode:'capture'|'resend-test';allowlist:string[]};
export function authorizeDevelopmentEmail(env: Record<string,string|undefined>, mail: unknown): {mode:'capture'|'resend-test';to?:string[];cc?:string[];bcc?:string[]};
