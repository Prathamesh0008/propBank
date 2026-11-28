"use client";
import {useState} from 'react';
import AddPropertyForm from '@/features/properties/AddPropertyForm';
import type {PropertyCategory} from '@/lib/property-category';
export default function AdminAddProperty(){const [category,setCategory]=useState<PropertyCategory>('residential');return <AddPropertyForm key={category} category={category} adminIntake adminCategorySelector={<label className="space-y-1 text-sm font-medium">Property category<select className="block min-h-11 w-full rounded border bg-white px-3 text-base" value={category} onChange={e=>{if(window.confirm('Changing category restarts this unsaved form. Continue?'))setCategory(e.target.value as PropertyCategory);}}>{['residential','commercial','industrial'].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></label>}/>}
