"use client";
import { z } from 'zod';
import type { FieldValues,Path,UseFormReturn } from 'react-hook-form';
import { FormField,FormItem,FormLabel,FormControl,FormMessage } from '@/ui/form';
import { Input } from '@/ui/input';
import AmountInWords from '@/components/AmountInWords';
import {PROPERTY_STRUCTURES,propertyCategory,structureUsesPlotArea,type PropertyCategory} from '@/lib/property-category';
const fields=[['propertyCategory','Property category'],['structure','Property type'],['buildingName','Building / Society name'],['expectedRent','Expected rent'],['areaUnit','Area unit'],['carpetAreaUnit','Carpet area unit'],['constructedAreaUnit','Built-up / Constructed area unit'],['plotAreaUnit','Plot area unit']] as const;
export const clientPropertySchema=Object.fromEntries(fields.map(([key])=>[key,z.string().optional()])) as Record<typeof fields[number][0],z.ZodOptional<z.ZodString>>;
const choices:Record<string,string[]>={propertyCategory:['residential','commercial','industrial'],structure:['Apartment','Independent House','Villa','Residential Plot','Office','Shop','Showroom','Commercial Plot','Warehouse','Factory','Industrial Shed','Industrial Plot','Flat','Bungalow','Unit','RCC Shed','Land'],areaUnit:['sq ft','sq m','sq yd','acre','hectare'],carpetAreaUnit:['sq ft','sq m','sq yd'],constructedAreaUnit:['sq ft','sq m','sq yd'],plotAreaUnit:['sq ft','sq m','sq yd','acre','hectare']};
export default function ClientPropertyFields<T extends FieldValues>({form,disabled=false,fixedCategory,creation=false}:{form:UseFormReturn<T>;disabled?:boolean;fixedCategory?:PropertyCategory;creation?:boolean}) {
  const selectedCategory=propertyCategory(fixedCategory||(typeof form.watch==='function'?form.watch('propertyCategory' as Path<T>):''));
  const plotStructure=structureUsesPlotArea(typeof form.watch==='function'?form.watch('structure' as Path<T>):'');
  const visibleFields=fields.filter(([key])=>{
    if(fixedCategory&&key==='propertyCategory')return false;
    if(creation&&['expectedRent','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit'].includes(key))return false;
    if(!creation&&selectedCategory&&plotStructure&&['carpetAreaUnit','constructedAreaUnit'].includes(key))return false;
    if(!creation&&selectedCategory&&!plotStructure&&key==='plotAreaUnit')return false;
    if(!creation&&selectedCategory&&key==='areaUnit')return false;
    return true;
  });
  return <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="font-semibold mb-3">{creation?'Building details':fixedCategory?'Building and area details':'Building, category and area details'}</legend>{visibleFields.map(([key,label])=>{
    const options=key==='structure'&&selectedCategory?[...PROPERTY_STRUCTURES[selectedCategory]]:choices[key];
    return <FormField key={key} control={form.control} name={key as Path<T>} render={({field})=><FormItem><FormLabel>{label}</FormLabel><FormControl>{options?<select disabled={disabled} aria-label={label} className="h-10 w-full border rounded px-3 bg-background" value={field.value||''} onChange={event=>{field.onChange(event);if(key==='propertyCategory')form.setValue('propertyType' as Path<T>,event.target.value as T[Path<T>],{shouldValidate:true});}}><option value="">Choose {label.toLowerCase()}</option>{field.value&&!options.includes(field.value)&&<option value={field.value}>{field.value}</option>}{options.map(value=><option key={value} value={value}>{value}</option>)}</select>:<Input disabled={disabled} {...field} value={field.value||''}/>}</FormControl>{key==='expectedRent'&&<AmountInWords amount={field.value}/>}<FormMessage/></FormItem>}/>;
  })}</fieldset>;
}
