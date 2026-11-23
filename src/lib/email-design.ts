import {formatDisplayDate,formatDisplayDateTime} from './date-format';
import {formatAddress} from './address-format';
import {formatPropertyAddress} from './property-address';

export type EmailRow={label:string;value:unknown;format?:'text'|'status'|'money'|'date'|'datetime';roles?:string[]};
export type EmailContext={greeting?:string;preheader?:string;status?:string;rows?:EmailRow[];nextStep?:string;audience?:string};
export type EmailAction={label:string;path:string};
/** Use only an already-authorized property snapshot; no lookups or private attachments. */
export function propertyEmailContext(property:Record<string,any>,rows:EmailRow[]=[],context:Omit<EmailContext,'rows'>={},compatibility:{legacyAddressFormat?:boolean}={}):EmailContext {
  const name=[property.buildingName||property.title,property.unitNumber].filter(value=>typeof value==='string'&&value.trim()).join(' - ');
  return {...context,rows:[{label:'Property',value:name},{label:'Address',value:compatibility.legacyAddressFormat?formatAddress(property.address||property.location,property.city,property.state,property.zipCode):formatPropertyAddress(property)},{label:'Property category',value:property.propertyCategory||property.propertyType,format:'status'},...rows]};
}
export const emailEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function emailTextFromHtml(html:string){return html.replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?:br\s*\/?|\/p|\/tr|\/h[1-6])>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '}[s]!)).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*/g,'\n\n').trim();}
export function emailLabel(value:unknown){const labels:Record<string,string>={rent:'For rent',sell:'For sale',pre_leased:'Pre-Leased Sale',manage:'To Manage',assign:'Tenant added',replace:'Tenant replaced',remove:'Tenant removed',notice_served:'Notice issued'};return labels[String(value)]||String(value??'').trim().replace(/[_.-]+/g,' ').replace(/\buid\b/gi,'account').replace(/^./,c=>c.toUpperCase());}
export function emailMoney(value:unknown){
  if(!['number','string'].includes(typeof value)||String(value).trim()===''||!/^\d+(?:\.\d+)?$/.test(String(value).trim()))return '';
  const number=Number(value);return Number.isFinite(number)&&number>=0?`\u20b9${number.toLocaleString('en-IN',{maximumFractionDigits:2})}`:'';
}
export function emailOrigin(){
  try{const url=new URL(process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL||'');
    const isolatedHttp=process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&(url.hostname==='local'||url.hostname.endsWith('.test'));
    if(url.username||url.password||url.protocol!=='https:'&&!isolatedHttp||/^(localhost|127\.|\[::1\])/.test(url.hostname))return '';
    return url.origin;
  }catch{return '';}
}
export function emailActionUrl(path:unknown){
  const origin=emailOrigin();if(!origin||typeof path!=='string'||!/^\/(?:admin(?:[?#]|$)|manage-property(?:[/?#]|$)|property\/|my-account(?:[?#]|$)|visit-planner(?:[?#]|$)|support(?:[?#]|$)|enquiries(?:[?#]|$))/.test(path)||/[\\\r\n]/.test(path))return '';
  try{const url=new URL(path,origin);if(url.origin!==origin||/%(?:2f|5c|0a|0d)/i.test(path)||/[?&](?:token|code|secret|api_key)=/i.test(path))return '';return url.href;}catch{return '';}
}
export function emailRows(rows:EmailRow[]=[]){return rows.flatMap(row=>{
  if(row.value===undefined||row.value===null||String(row.value).trim()==='')return [];
  const value=row.format==='money'?emailMoney(row.value):row.format==='date'?formatDisplayDate(row.value,{},''):row.format==='datetime'?formatDisplayDateTime(row.value,{},''):row.format==='status'?emailLabel(row.value):String(row.value).trim();
  return value?[{label:row.label,value}]:[];
});}
/** Server-owned, escaped body fragments only. Never pass customer-supplied HTML. */
export function renderTransactionalEmail(title:string,bodyHtml:string,bodyText:string,action?:EmailAction,context:EmailContext={}){
  const origin=emailOrigin(),href=action?emailActionUrl(action.path):'',rows=emailRows(context.rows?.filter(row=>!row.roles||row.roles.includes(context.audience||''))),greeting=context.greeting?.trim()?`Hello ${context.greeting.trim()},`:'Hello,',preheader=context.preheader||bodyText.replace(/\s+/g,' ').slice(0,170),status=emailLabel(context.status);
  const fragment=/<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(bodyHtml)?.[1]||bodyHtml;
  const summary=rows.length?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:22px 0">${rows.map(row=>`<tr><td width="38%" valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid #E6E1D6;color:#555E59;font-size:14px">${emailEscape(row.label)}</td><td valign="top" style="padding:11px 0;border-bottom:1px solid #E6E1D6;color:#242B28;font-size:15px;word-break:break-word">${emailEscape(row.value)}</td></tr>`).join('')}</table>`:'';
  const button=href?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:25px 0"><tr><td bgcolor="#183C32" style="padding:14px 22px"><a href="${emailEscape(href)}" style="color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;display:inline-block">${emailEscape(action!.label)}</a></td></tr></table><p style="font-size:12px;color:#555E59">If the button does not open, use this link:<br><a href="${emailEscape(href)}" style="color:#183C32;word-break:break-all">${emailEscape(href)}</a></p>`:'';
  const logo=origin?`<img src="${emailEscape(origin)}/images/pb1_logo.png" width="52" height="52" alt="PropBank logo" style="display:block;border:0;background:#FFFFFF"/>`:'';
  const footer='This is a transactional notification from PropBank. Sign in to review the latest authorized information. Never share your password or verification codes.';
  return {html:`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${emailEscape(title)}</title><style>@media only screen and (max-width:480px){.pb-pad{padding:22px 18px!important}.pb-outer{padding:12px 6px!important}}</style></head><body data-pb-email="2" style="margin:0;padding:0;background:#F8F6F0;color:#242B28;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${emailEscape(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pb-outer" align="center" style="padding:28px 12px"><!--[if mso]><table role="presentation" width="620"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border:1px solid #E6E1D6"><tr><td bgcolor="#183C32" class="pb-pad" style="padding:22px 30px;border-bottom:3px solid #876D4A"><table role="presentation"><tr><td>${logo}</td><td style="padding-left:14px;color:#FFFFFF;font-size:25px;font-weight:bold">PropBank<br><span style="font-size:12px;font-weight:normal;color:#F8F6F0">Property management, thoughtfully connected</span></td></tr></table></td></tr><tr><td class="pb-pad" style="padding:30px;font-size:15px;line-height:1.7"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#183C32">${emailEscape(title)}</h1>${status?`<p style="margin:0 0 20px;color:#183C32;font-weight:bold">Status: ${emailEscape(status)}</p>`:''}<p>${emailEscape(greeting)}</p>${fragment}${summary}${context.nextStep?`<p><strong>What happens next</strong><br>${emailEscape(context.nextStep)}</p>`:''}${button}</td></tr><tr><td class="pb-pad" style="padding:22px 30px;border-top:1px solid #E6E1D6;background:#F8F6F0;font-size:12px;line-height:1.7;color:#555E59"><strong style="color:#183C32">PropBank</strong><br>${footer}${origin?`<br><a href="${emailEscape(origin)}/support" style="color:#183C32">Contact support</a>`:''}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`,text:`PropBank\n\n${title}\n\n${greeting}\n\n${bodyText}${status?`\n\nStatus: ${status}`:''}${rows.length?`\n\n${rows.map(row=>`${row.label}: ${row.value}`).join('\n')}`:''}${context.nextStep?`\n\nWhat happens next: ${context.nextStep}`:''}${href?`\n\n${action!.label}: ${href}`:''}\n\n${footer}${origin?`\nSupport: ${origin}/support`:''}`};
}
