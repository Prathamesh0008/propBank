export async function readPropertyResponse(response:Response):Promise<{success:boolean;message?:string;property?:{id?:string;moderationStatus?:string}}> {
  const text=await response.text();
  let result:unknown;
  try {result=JSON.parse(text);}catch {
    const contentType=response.headers.get('content-type')||'';
    const message=!response.ok&&contentType.includes('text/plain')&&!/[<>]/.test(text)?text.trim().slice(0,500):'';
    throw new Error(message||`Property submission returned an unexpected response (HTTP ${response.status}). Please try again.`);
  }
  if(!result||typeof result!=='object'||!('success' in result)||typeof result.success!=='boolean')throw new Error(`Invalid property submission response (HTTP ${response.status}). Please try again.`);
  const value=result as {success:boolean;message?:unknown;property?:unknown;fieldErrors?:unknown};
  const message=typeof value.message==='string'?value.message:undefined;
  if(!response.ok||!value.success){const fields=value.fieldErrors&&typeof value.fieldErrors==='object'?Object.fromEntries(Object.entries(value.fieldErrors).filter((entry):entry is [string,string]=>typeof entry[1]==='string')):{};throw new PropertySubmissionError(message||`Property submission failed (HTTP ${response.status}). Please try again.`,fields);}
  const rawProperty=value.property&&typeof value.property==='object'?value.property as Record<string,unknown>:undefined;
  const property=rawProperty?{
    ...(typeof rawProperty.id==='string'?{id:rawProperty.id}:{}),
    ...(typeof rawProperty.moderationStatus==='string'?{moderationStatus:rawProperty.moderationStatus}:{}),
  }:undefined;
  return {success:true,message,property};
}
export class PropertySubmissionError extends Error {
  constructor(message:string,public readonly fieldErrors:Record<string,string>={}){super(message);}
}
