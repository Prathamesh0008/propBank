export type AmountValue = string | number | null | undefined;

const ONES=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const MAX_RUPEES=9_999_999_999n; // 999 crore, 99 lakh, 99 thousand, 999.

function belowThousand(value:number):string {
  const words:string[]=[];
  if(value>=100){words.push(ONES[Math.floor(value/100)],'Hundred');value%=100;}
  if(value>=20){words.push(TENS[Math.floor(value/10)]);value%=10;}
  if(value>0)words.push(ONES[value]);
  return words.join(' ');
}

function rupeeWords(value:bigint):string {
  if(value===0n)return 'Zero';
  const words:string[]=[];
  const groups:[bigint,string][]=[[10_000_000n,'Crore'],[100_000n,'Lakh'],[1_000n,'Thousand']];
  for(const [size,label] of groups){
    if(value>=size){const count=Number(value/size);words.push(belowThousand(count),label);value%=size;}
  }
  if(value>0n)words.push(belowThousand(Number(value)));
  return words.join(' ');
}

function normalizedAmount(value:AmountValue):{rupees:bigint;paise:number}|null {
  if(value===null||value===undefined)return null;
  let raw: string;
  if(typeof value==='number'){
    if(!Number.isFinite(value)||value<0||value>Number(MAX_RUPEES))return null;
    raw=value.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
  }else raw=value.trim();
  if(!raw||raw.endsWith('.')||!/^[\d,]+(?:\.\d{1,2})?$/.test(raw))return null;
  const [formattedWhole]=raw.split('.');
  const hasValidGrouping=/^\d+$/.test(formattedWhole)
    ||/^\d{1,2}(?:,\d{2})*,\d{3}$/.test(formattedWhole)
    ||/^\d{1,3}(?:,\d{3})+$/.test(formattedWhole);
  if(!hasValidGrouping)return null;
  const compact=raw.replaceAll(',','');
  if(!/^\d+(?:\.\d{1,2})?$/.test(compact))return null;
  const [whole,fraction='']=compact.split('.');
  let rupees:bigint;try{rupees=BigInt(whole);}catch{return null;}
  if(rupees>MAX_RUPEES)return null;
  return {rupees,paise:fraction?Number(fraction.padEnd(2,'0')):0};
}

/** Converts a currency input without changing or numerically coercing the stored value. */
export function amountToWords(value:AmountValue):string {
  const parsed=normalizedAmount(value);if(!parsed)return '';
  const parts=[`${rupeeWords(parsed.rupees)} ${parsed.rupees===1n?'Rupee':'Rupees'}`];
  if(parsed.paise)parts.push(`and ${belowThousand(parsed.paise)} ${parsed.paise===1?'Paisa':'Paise'}`);
  return `${parts.join(' ')} Only`;
}

export const MAX_AMOUNT_IN_WORDS=MAX_RUPEES.toString();
