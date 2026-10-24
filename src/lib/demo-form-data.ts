export type DemoField={type?:string;name?:string;id?:string;placeholder?:string;label?:string;options?:Array<{value:string;disabled?:boolean}>};

const includes=(value:string,words:string[])=>words.some(word=>value.includes(word));
const futureDate=(days:number)=>{const date=new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10);};
const currentMonth=()=>new Date().toISOString().slice(0,7);

export function demoValueFor(field:DemoField):string|boolean|null {
  const type=(field.type||'text').toLowerCase(),key=[field.name,field.id,field.placeholder,field.label].filter(Boolean).join(' ').toLowerCase();
  const compact=key.replace(/[^a-z0-9]/g,'');
  if(['password','file','hidden','submit','button','reset'].includes(type)||includes(key,['password','otp','one-time','token','secret','payment credential','card number','cvv'])||/(?:firebase|property|owner|tenant|agent|broker|user)(?:id|uid)/.test(compact))return null;
  if(type==='checkbox')return true;
  if(type==='radio')return key.includes('individual')||key.includes('residential')||key.includes('rent');
  if(type==='date')return futureDate(includes(key,['end','expiry','expiration'])?365:includes(key,['visit','schedule','due'])?7:1);
  if(type==='datetime-local')return `${futureDate(7)}T11:30`;
  if(type==='time')return '11:30';
  if(type==='month')return currentMonth();
  if(type==='email')return key.includes('owner')?'demo.owner@propbank.test':key.includes('tenant')?'demo.tenant@propbank.test':'demo.visitor@propbank.test';
  if(type==='tel'||includes(key,['phone','mobile','contact number']))return '9876543210';
  if(type==='number') {
    if(includes(key,['price','sale']))return '8500000';if(includes(key,['rent']))return '32000';if(includes(key,['deposit','security']))return '96000';
    if(includes(key,['area','carpet','built']))return '1180';if(includes(key,['bedroom','beds','bhk']))return '2';if(includes(key,['bath']))return '2';
    if(includes(key,['floor']))return key.includes('total')?'18':'7';if(includes(key,['month','period','duration']))return '11';if(includes(key,['due day']))return '5';
    if(includes(key,['percentage','percent']))return '5';return '1';
  }
  if(type==='select-one'||type==='select-multiple') {
    if(includes(key,['property id','owner','tenant','agent','broker','user account','registered user','receipt document']))return null;
    return field.options?.find(option=>option.value&&!option.disabled)?.value||null;
  }
  if(includes(key,['full name','your name','visitor name','requester name']))return 'Aarav Mehta';
  if(includes(key,['owner name']))return 'Meera Kulkarni';if(includes(key,['tenant name']))return 'Rohan Deshmukh';
  if(includes(key,['building','project name','property name']))return 'Demo — Sahyadri Heights';
  if(includes(key,['flat','unit number','unit no']))return 'A-704';
  if(includes(key,['title','subject']))return key.includes('visit')?'Demo — Sahyadri Heights viewing':'Demo — PropBank test submission';
  if(includes(key,['address']))return 'A-704, Sahyadri Heights, Baner Road';
  if(includes(key,['locality','area name','neighbourhood']))return 'Baner';if(includes(key,['city']))return 'Pune';if(includes(key,['state']))return 'Maharashtra';if(includes(key,['pincode','postal']))return '411045';
  if(includes(key,['location']))return 'Baner, Pune, Maharashtra';
  if(includes(key,['amenit']))return 'Covered parking, lift, security, garden and power backup';
  if(includes(key,['offer','amount']))return '7800000';
  if(includes(key,['reason']))return 'Demo — documents require clearer ownership evidence.';
  if(includes(key,['note','comment','description','details','message','remarks','review']))return 'Demo — Please review this sample request created for local PropBank testing.';
  if(includes(key,['company','agency']))return 'Demo — Deccan Property Advisors';
  if(includes(key,['occupation']))return 'Software Engineer';
  if(includes(key,['url','website']))return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c';
  return 'Demo — PropBank test data';
}

export function isDemoAutofillEnvironment(hostname:string,nodeEnv:string|undefined){return nodeEnv!=='production'&&['localhost','127.0.0.1','::1'].includes(hostname.toLowerCase());}

