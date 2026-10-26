import 'server-only';
export interface Email {to:string;subject:string;html:string;text?:string}
export async function sendEmail(mail:Email,idempotencyKey?:string) {
  if(!mail.to)throw new Error('Email recipient is required');
  if(!process.env.RESEND_API_KEY)throw new Error('Email provider is not configured');
  const from=process.env.FROM_EMAIL||'connect@propbank.shop';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json',...(idempotencyKey!==undefined?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:`PropBank <${from}>`,to:[mail.to],subject:mail.subject,html:mail.html.replaceAll('connectpropbank@gmail.com',from),...(mail.text?{text:mail.text}:{})}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Property email delivery failed');
  let id='';try{const payload=await response.json() as {id?:unknown};if(typeof payload.id==='string')id=payload.id;}catch{/* A successful provider response may omit JSON in tests or compatible transports. */}
  return {id};
}
