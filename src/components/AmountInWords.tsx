import { amountToWords, type AmountValue } from '@/lib/amount-to-words';

export default function AmountInWords({amount,className=''}:{amount:AmountValue;className?:string}) {
  const words=amountToWords(amount);if(!words)return null;
  return <p className={`mt-1 text-[11px] leading-4 text-muted-foreground ${className}`.trim()} aria-live="off">{words}</p>;
}
