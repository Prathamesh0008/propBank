import 'server-only';
import {normalizeEmailAddress} from '@/lib/email-address';
export interface Email {to:string;subject:string;html:string;text?:string}
export const DEFAULT_EMAIL_SENDER='connect@propbank.care';
export class EmailConfigurationError extends Error {}
export function getSenderAddress(){
  if(/[\r\n]/.test(process.env.FROM_EMAIL||''))throw new EmailConfigurationError('FROM_EMAIL must be a valid sender address');
  const from=normalizeEmailAddress(process.env.FROM_EMAIL?.trim()||DEFAULT_EMAIL_SENDER);
  if(!from)throw new EmailConfigurationError('FROM_EMAIL must be a valid sender address');
  if(from.endsWith('@propbank.shop'))throw new EmailConfigurationError('FROM_EMAIL uses a retired sender domain; configure connect@propbank.care');
  return from;
}
export class EmailProviderError extends Error {
  constructor(public readonly status:number,public readonly providerCode:string){super('Property email delivery failed');}
}
export async function sendEmail(mail:Email,idempotencyKey?:string) {
  if(!mail.to)throw new Error('Email recipient is required');
  if(!process.env.RESEND_API_KEY)throw new EmailConfigurationError('RESEND_API_KEY is not configured');
  const from=getSenderAddress();
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json',...(idempotencyKey!==undefined?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:`PropBank <${from}>`,to:[mail.to],subject:mail.subject,html:mail.html.replaceAll('connectpropbank@gmail.com',from),...(mail.text?{text:mail.text}:{})}),signal:AbortSignal.timeout(30000)});
  if(!response.ok){
    let providerCode='provider_error';
    try{const data=await response.json() as {name?:unknown;message?:unknown};
      if(typeof data.name==='string'&&['validation_error','restricted_api_key','invalid_api_key','rate_limit_exceeded','missing_required_field','application_error','invalid_idempotent_request','concurrent_idempotent_requests'].includes(data.name))providerCode=data.name;
      if(typeof data.message==='string'&&/domain.*not verified/i.test(data.message))providerCode='sender_domain_not_verified';
    }catch{/* Never persist or log raw provider response bodies. */}
    throw new EmailProviderError(response.status,providerCode);
  }
  let id='';try{const payload=await response.json() as {id?:unknown};if(typeof payload.id==='string')id=payload.id;}catch{/* A successful provider response may omit JSON in tests or compatible transports. */}
  return {id};
}
