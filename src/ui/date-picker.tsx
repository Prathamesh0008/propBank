"use client";
import * as React from 'react';
import {format,parse,isValid} from 'date-fns';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {Calendar} from './calendar';
import {Popover,PopoverContent,PopoverTrigger} from './popover';
import {calendarAllowed,calendarToday,calendarValue,parseCalendarDate,parseCalendarDisplay} from '@/lib/calendar-date';
import styles from './calendar.module.css';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,'value'|'defaultValue'|'onChange'|'min'|'max'|'type'> {
 value?:string;defaultValue?:string;onChange?:(value:string)=>void;min?:string;max?:string;
 disabledDate?:(date:Date)=>boolean;timeZone?:string;displayFormat?:string;valueFormat?:string;
 clearable?:boolean;showToday?:boolean;mode?:'date'|'month';
}
export const DatePicker=React.forwardRef<HTMLInputElement,DatePickerProps>(function DatePicker({value,defaultValue='',onChange,min,max,disabledDate,timeZone='Asia/Kolkata',displayFormat,valueFormat='yyyy-MM-dd',clearable=true,showToday=true,mode='date',className,placeholder,disabled,readOnly,required,name,id,onBlur,onKeyDown,...inputProps},forwardedRef){
 const controlled=value!==undefined;
 const [internal,setInternal]=React.useState(defaultValue),[open,setOpen]=React.useState(false),[invalid,setInvalid]=React.useState(false);
 const input=React.useRef<HTMLInputElement>(null),generated=React.useId(),errorId=generated+'-error';
 const canonical=(raw:string)=>{if(!raw)return '';if(mode==='month')return /^\d{4}-\d{2}$/.test(raw)&&parseCalendarDate(raw+'-01')?raw+'-01':'';if(valueFormat==='yyyy-MM-dd')return parseCalendarDate(raw)?raw:'';const parsed=parse(raw,valueFormat,new Date(2000,0,1));return isValid(parsed)&&format(parsed,valueFormat)===raw?calendarValue(parsed):'';};
 const current=controlled?value:internal,selected=canonical(current),today=calendarToday(timeZone),displayPattern=displayFormat||(mode==='month'?'MM-yyyy':'dd-MM-yyyy');
 const show=(raw:string)=>{const date=parseCalendarDate(canonical(raw));return date?format(date,displayPattern):'';};
 const [draft,setDraft]=React.useState(()=>show(current)),[month,setMonth]=React.useState(()=>parseCalendarDate(selected||today)!);
 React.useEffect(()=>{setDraft(show(current));setInvalid(false);input.current?.setCustomValidity('');},[current,displayPattern,valueFormat,mode]);
 React.useEffect(()=>{if(current){const raw=canonical(current),valid=!!raw&&allowed(raw);setInvalid(!valid);input.current?.setCustomValidity(valid?'':'Choose an available, valid date.');}},[current,min,max,disabledDate]);
 React.useEffect(()=>{const form=input.current?.form;if(!form||controlled)return;const reset=()=>{setInternal(defaultValue);setDraft(show(defaultValue));setInvalid(false);input.current?.setCustomValidity('');};form.addEventListener('reset',reset);return()=>form.removeEventListener('reset',reset);},[controlled,defaultValue]);
 const allowed=(raw:string)=>mode==='month'?!!parseCalendarDate(raw)&&(!min||raw.slice(0,7)>=min.slice(0,7))&&(!max||raw.slice(0,7)<=max.slice(0,7)):calendarAllowed(raw,min,max,disabledDate);
 const commit=(raw:string)=>{const date=parseCalendarDate(raw);const next=date?(mode==='month'?raw.slice(0,7):format(date,valueFormat)):'';if(!controlled)setInternal(next);onChange?.(next);setDraft(date?format(date,displayPattern):'');setInvalid(false);input.current?.setCustomValidity('');};
 const type=(text:string)=>{setDraft(text);if(!text){commit('');return;}let raw='';if(mode==='month'){const match=/^(\d{2})-(\d{4})$/.exec(text);if(match)raw=match[2]+'-'+match[1]+'-01';}else if(displayPattern==='dd-MM-yyyy')raw=parseCalendarDisplay(text);else{const date=parse(text,displayPattern,new Date(2000,0,1));if(isValid(date)&&format(date,displayPattern)===text)raw=calendarValue(date);}const valid=!!raw&&allowed(raw);setInvalid(!valid);input.current?.setCustomValidity(valid?'':'Enter an available, valid '+displayPattern.toUpperCase()+' date.');if(valid)commit(raw);};
 React.useEffect(()=>{if(disabled||readOnly)setOpen(false);},[disabled,readOnly]);
 const readonly=disabled||readOnly;
 return <Popover open={open} onOpenChange={next=>{if(!readonly){if(next)setMonth(parseCalendarDate(selected||today)!);setOpen(next);}}}>
  <div className={styles.field}>
   <input {...inputProps} ref={element=>{input.current=element;if(typeof forwardedRef==='function')forwardedRef(element);else if(forwardedRef)forwardedRef.current=element;}} id={id||generated} type="text" className={[styles.input,className].filter(Boolean).join(' ')} value={draft} placeholder={placeholder||displayPattern.toUpperCase()} disabled={disabled} readOnly={readOnly} required={required} autoComplete="off" aria-invalid={invalid||inputProps['aria-invalid']} aria-describedby={[inputProps['aria-describedby'],invalid?errorId:''].filter(Boolean).join(' ')||undefined} onChange={e=>type(e.target.value)} onBlur={onBlur} onKeyDown={e=>{onKeyDown?.(e);if(e.key==='ArrowDown'&&!readonly){e.preventDefault();setOpen(true);}if(e.key==='Escape')setOpen(false);}}/>
   {name&&<input type="hidden" name={name} value={current} disabled={disabled}/>}
   <PopoverTrigger asChild><button type="button" className={styles.trigger} disabled={!!readonly} aria-label={'Open calendar'+(inputProps['aria-label']?' for '+inputProps['aria-label']:'')}><CalendarDays size={17} aria-hidden="true"/></button></PopoverTrigger>
   {invalid&&<span id={errorId} className={styles.error} role="alert">Enter an available, valid {displayPattern.toUpperCase()} date.</span>}
  </div>
  <PopoverContent className={styles.popover} align="start" collisionPadding={12} sideOffset={6} aria-label={mode==='month'?'Choose month':'Choose date'} onCloseAutoFocus={e=>{e.preventDefault();input.current?.focus();}}>
   {mode==='date'?<Calendar mode="single" month={month} onMonthChange={setMonth} selected={parseCalendarDate(selected)} today={parseCalendarDate(today)} onSelect={date=>{if(date&&allowed(calendarValue(date))){commit(calendarValue(date));setOpen(false);}}} disabled={date=>!allowed(calendarValue(date))} initialFocus/>:<><div className={styles.caption}><button type="button" aria-label="Previous year" onClick={()=>setMonth(new Date(month.getFullYear()-1,0,1))}><ChevronLeft size={16}/></button><input aria-label="Calendar year" type="number" min={1} max={9999} value={month.getFullYear()} onChange={e=>{const year=Number(e.target.value);if(year>0&&year<=9999){const next=new Date(month);next.setFullYear(year);setMonth(next);}}}/><button type="button" aria-label="Next year" onClick={()=>setMonth(new Date(month.getFullYear()+1,0,1))}><ChevronRight size={16}/></button></div><div className={styles.months}>{Array.from({length:12},(_,m)=>{const raw=String(month.getFullYear()).padStart(4,'0')+'-'+String(m+1).padStart(2,'0')+'-01';return <button type="button" key={m} aria-pressed={selected.slice(0,7)===raw.slice(0,7)} disabled={!allowed(raw)} onClick={()=>{commit(raw);setOpen(false);}}>{new Date(2000,m,1).toLocaleString('en-IN',{month:'short'})}</button>;})}</div></>}
   <div className={styles.footer}>{showToday&&<button type="button" disabled={!allowed(mode==='month'?today.slice(0,7)+'-01':today)} onClick={()=>{commit(mode==='month'?today.slice(0,7)+'-01':today);setOpen(false);}}>Today</button>}{clearable&&!required&&<button type="button" onClick={()=>{commit('');setOpen(false);}}>Clear</button>}</div>
  </PopoverContent>
 </Popover>;
});
// Compatibility bridge: existing Input handlers receive canonical values, never display text.
export const CalendarInput=React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function CalendarInput({type,value,defaultValue,onChange,onBlur,min,max,...props},ref){
 return <DatePicker {...props} ref={ref} mode={type==='month'?'month':'date'} value={value===undefined?undefined:String(value)} defaultValue={defaultValue===undefined?'':String(defaultValue)} min={min===undefined?undefined:String(min)} max={max===undefined?undefined:String(max)} onBlur={event=>{const target={name:props.name||'',value:(event.currentTarget.parentElement?.querySelector('input[type=hidden]') as HTMLInputElement|null)?.value||''};onBlur?.({...event,target,currentTarget:target} as unknown as React.FocusEvent<HTMLInputElement>);}} onChange={next=>{const target={value:next,name:props.name||''};onChange?.({target,currentTarget:target,type:'change'} as unknown as React.ChangeEvent<HTMLInputElement>);}}/>;
});
export interface DateRangeValue {from:string;to:string}
export function DateRangePicker({value,defaultValue={from:'',to:''},onChange,fromName,toName,fromLabel='From date',toLabel='To date',...props}:Omit<DatePickerProps,'value'|'defaultValue'|'onChange'|'name'|'mode'> & {value?:DateRangeValue;defaultValue?:DateRangeValue;onChange?:(value:DateRangeValue)=>void;fromName?:string;toName?:string;fromLabel?:string;toLabel?:string}){
 const [internal,setInternal]=React.useState(defaultValue),range=value??internal;
 const change=(next:DateRangeValue)=>{if(value===undefined)setInternal(next);onChange?.(next);};
 return <div className={styles.range}><label>{fromLabel}<DatePicker {...props} name={fromName} value={range.from} max={range.to&&props.max?(range.to<props.max?range.to:props.max):range.to||props.max} onChange={from=>change({...range,from})}/></label><label>{toLabel}<DatePicker {...props} name={toName} value={range.to} min={range.from&&props.min?(range.from>props.min?range.from:props.min):range.from||props.min} onChange={to=>change({...range,to})}/></label></div>;
}
