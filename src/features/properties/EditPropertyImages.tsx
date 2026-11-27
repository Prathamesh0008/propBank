"use client";
import {useRef,type ChangeEvent} from 'react';
import SessionMediaImage from '@/components/SessionMediaImage';
import {Button} from '@/ui/button';

export default function EditPropertyImages({label,images,busy,onUpload,onRemove}:{label:string;images:string[];busy:boolean;onUpload:(event:ChangeEvent<HTMLInputElement>)=>void;onRemove:(index:number)=>void}) {
  const input=useRef<HTMLInputElement>(null);
  return <section className="min-w-0 space-y-3"><h3>{label}</h3><input ref={input} aria-label={label} type="file" multiple accept="image/*" className="hidden" disabled={busy} onChange={onUpload}/><Button type="button" variant="outline" disabled={busy||images.length>=6} onClick={()=>input.current?.click()}>{busy?'Working...':`Upload ${label.toLowerCase()} (Max 6)`}</Button><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">{images.map((src,index)=><div key={`${src}-${index}`} className="min-w-0 space-y-2"><SessionMediaImage src={src} alt={`${label} ${index+1}`} className="h-32 w-full rounded-lg object-cover"/><Button type="button" variant="outline" disabled={busy} aria-label={`Remove ${label.toLowerCase()} ${index+1}`} onClick={()=>onRemove(index)}>Remove</Button></div>)}</div></section>;
}
