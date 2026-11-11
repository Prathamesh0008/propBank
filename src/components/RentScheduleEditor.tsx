"use client";
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { DatePicker } from '@/ui/date-picker';
import { rentYearLabel, agreementMonths, arrangeRentSchedule, initializeRentSchedule, validateUnifiedRentSchedule, suggestedRent, type RentScheduleRow } from '@/lib/rent-schedule';
import styles from './RentScheduleEditor.module.css';
export default function RentScheduleEditor({ value, onChange, start, end, rent, percentage = '', fixed = '', compact = false }: {
    value: RentScheduleRow[];
    onChange: (rows: RentScheduleRow[]) => void;
    start: string;
    end: string;
    rent: string;
    percentage?: string;
    fixed?: string;
    compact?: boolean;
}) {
    const previous = useRef(''), callback = useRef(onChange);
    callback.current = onChange;
    const [undo, setUndo] = useState<RentScheduleRow[] | null>(null), [notice, setNotice] = useState('');
    useEffect(() => {
        const key = `${start}|${end}|${rent}`;
        if (compact && !value.length && !agreementMonths(start, end)) {
            callback.current([{year:rentYearLabel(0),months:'11',amount:rent,fromDate:start,toDate:end}]);
            return;
        }
        if (previous.current === key || !agreementMonths(start, end)) return;
        const prior = previous.current.split('|'), changed = !!previous.current;
        const source = value.map((row, index) => index === 0 && row.amount === (prior[2] || '') ? {...row,amount:rent} : row);
        previous.current = key;
        // Updating the rent must not recreate removed years or reset custom months.
        if (compact && changed && prior[0] === start && prior[1] === end) {
            if (JSON.stringify(source) !== JSON.stringify(value)) callback.current(source);
            return;
        }
        if (!changed && value.length && !validateUnifiedRentSchedule(value,start,end)) return;
        const rows = initializeRentSchedule(source,start,end,rent);
        if (changed && value.length) {
            setUndo(value.map(row=>({...row})));
            setNotice('Agreement changed. Rent amounts were retained where possible; review all periods. Undo restores previous entries for review.');
        }
        callback.current(rows);
    }, [start,end,rent,compact]);
    const error = validateUnifiedRentSchedule(value, start, end), covered = value.reduce((sum, r) => sum + Number(r.months || 0), 0), remaining = agreementMonths(start, end) - covered;
    const change = (index: number, field: keyof RentScheduleRow, text: string) => { const rows = value.map((row, i) => i === index ? { ...row, [field]: text } : row); onChange(field === 'months' ? arrangeRentSchedule(rows, start, end) : rows); };
    return <section className={`${styles.editor} ${compact ? styles.compact : ''}`} aria-label="Monthly Rent Schedule"><header><h2>Monthly Rent Schedule</h2><Button type="button" variant="outline" size="sm" disabled={remaining <= 0} onClick={() => onChange(arrangeRentSchedule([...value, { year: '', months: String(Math.min(12, remaining)), amount: '', fromDate: '', toDate: '' }], start, end))}>+ Add Year</Button></header>{value.map((row, index) => { const suggestion = index ? suggestedRent(value[index - 1].amount, percentage, fixed) : rent; return <div className={styles.row} key={index}><label>Year{compact?<Input readOnly value={rentYearLabel(index)} aria-label={`Rent schedule year ${index+1}`}/>:<strong>{rentYearLabel(index)}</strong>}</label><label>Months<Input type="number" min={1} step={1} value={row.months} onChange={e => change(index, 'months', e.target.value)}/></label><label>{compact?'Amount (₹)':'Monthly Rent (₹)'}<Input type="number" min={0.01} step="0.01" value={row.amount} onChange={e => change(index, 'amount', e.target.value)}/>{index > 0 && suggestion && <button type="button" className={styles.suggestion} onClick={() => change(index, 'amount', suggestion)}>Use suggested ₹{suggestion}</button>}</label><label>From<DatePicker value={row.fromDate} min={start} max={end} onChange={v => change(index, 'fromDate', v)}/></label><label>To<DatePicker value={row.toDate} min={start} max={end} onChange={v => change(index, 'toDate', v)}/></label>{index > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { setUndo(value.map(r => ({ ...r }))); onChange(arrangeRentSchedule(value.filter((_, i) => i !== index), start, end)); }}>Remove</Button>}</div>; })}<p>{compact&&'Adding a year changes rent within this agreement; it does not create or renew an agreement. '}Escalation amounts are suggestions only. Enter or explicitly select each monthly rent to confirm it.</p>{notice && <p role="status">{notice}</p>}{undo && <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(undo); setUndo(null); setNotice('Previous entries restored. Check dates against the current agreement.'); }}>Undo last change</Button>}{error && <p role="alert" className={styles.error}>{error}</p>}</section>;
}
