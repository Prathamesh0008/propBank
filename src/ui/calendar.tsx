"use client";
import {DayPicker,useNavigation,type CaptionProps} from 'react-day-picker';
import {enIN} from 'date-fns/locale';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import styles from './calendar.module.css';
export type CalendarProps=React.ComponentProps<typeof DayPicker>;
function MonthCaption({displayMonth,id}:CaptionProps){
 const {goToMonth,previousMonth,nextMonth}=useNavigation();
 const change=(year:number,month:number)=>{if(Number.isInteger(year)&&year>=1&&year<=9999){const next=new Date(displayMonth);next.setDate(1);next.setFullYear(year,month,1);goToMonth(next);}};
 return <div className={styles.caption}><span id={id} className={styles.srOnly} aria-live="polite">{displayMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</span><button type="button" aria-label="Previous month" disabled={!previousMonth} onClick={()=>previousMonth&&goToMonth(previousMonth)}><ChevronLeft size={16}/></button><select aria-label="Calendar month" value={displayMonth.getMonth()} onChange={e=>change(displayMonth.getFullYear(),Number(e.target.value))}>{Array.from({length:12},(_,month)=><option key={month} value={month}>{new Date(2000,month,1).toLocaleString('en-IN',{month:'long'})}</option>)}</select><input aria-label="Calendar year" type="number" min={1} max={9999} value={displayMonth.getFullYear()} onChange={e=>change(Number(e.target.value),displayMonth.getMonth())}/><button type="button" aria-label="Next month" disabled={!nextMonth} onClick={()=>nextMonth&&goToMonth(nextMonth)}><ChevronRight size={16}/></button></div>;
}
export function Calendar({className,classNames,components,...props}:CalendarProps){
 return <DayPicker locale={enIN} showOutsideDays className={[styles.calendar,className].filter(Boolean).join(' ')} classNames={{caption:styles.caption,table:styles.table,head_cell:styles.weekday,cell:styles.cell,day:styles.day,day_selected:styles.selected,day_today:styles.today,day_outside:styles.outside,day_disabled:styles.unavailable,day_hidden:styles.hidden,day_range_middle:styles.middle,...classNames}} components={{Caption:MonthCaption,...components}} {...props}/>;
}
