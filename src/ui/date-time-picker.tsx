"use client";
import {useState} from 'react';
import {DatePicker,type DatePickerProps} from './date-picker';
import {TimePicker} from './time-picker';
import styles from './calendar.module.css';
export interface ScheduleDateTime {date:string;time:string}
// Keep separate date and HH:mm values; the feature owns its IANA timezone,
// allowed slots and conversion to an instant. No implicit UTC conversion.
export function DateTimePicker({value,defaultValue={date:'',time:''},onChange,...dateProps}:Omit<DatePickerProps,'value'|'defaultValue'|'onChange'|'mode'> & {value?:ScheduleDateTime;defaultValue?:ScheduleDateTime;onChange?:(value:ScheduleDateTime)=>void}){
 const [internal,setInternal]=useState(defaultValue),selected=value??internal;
 const change=(next:ScheduleDateTime)=>{if(value===undefined)setInternal(next);onChange?.(next);};
 return <div className={styles.range}><label>Date<DatePicker {...dateProps} value={selected.date} onChange={date=>change({...selected,date})}/></label><TimePicker value={selected.time} required={dateProps.required} onChange={time=>change({...selected,time})}/></div>;
}
