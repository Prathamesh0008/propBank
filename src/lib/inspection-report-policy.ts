export const INSPECTION_REPORT_TYPES=['on_possession','on_handover'] as const;
export type InspectionReportType=typeof INSPECTION_REPORT_TYPES[number];
export const INSPECTION_FILE_LIMITS={individualBytes:5*1024*1024,totalBytes:25*1024*1024,conditionImages:8,totalFiles:15} as const;
export const INSPECTION_COMMON_FILE_FIELDS=['electricityBillMeterImage','electricityBillReceipt','apartmentConditionImages','mglBillMeterImage','mglBillReceipt','internetImage','internetReceipt'] as const;
export const INSPECTION_UNIQUE_FILE_FIELDS={on_possession:['possessionLetterFile'],on_handover:['handoverLetterFile']} as const;
export const INSPECTION_ALL_FILE_FIELDS=['possessionLetterFile','handoverLetterFile',...INSPECTION_COMMON_FILE_FIELDS] as const;
export type InspectionFileField=typeof INSPECTION_ALL_FILE_FIELDS[number];
export type InspectionFiles=Partial<Record<InspectionFileField,string|string[]>>;

export function inspectionType(value:unknown):InspectionReportType|null{return INSPECTION_REPORT_TYPES.includes(value as InspectionReportType)?value as InspectionReportType:null;}
export function allowedInspectionFields(type:InspectionReportType):readonly InspectionFileField[]{return [...INSPECTION_UNIQUE_FILE_FIELDS[type],...INSPECTION_COMMON_FILE_FIELDS];}
export function dataUrlBytes(value:string){const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);if(!match)return null;const body=match[2],padding=body.endsWith('==')?2:body.endsWith('=')?1:0;return {contentType:match[1].toLowerCase(),bytes:Math.max(0,Math.floor(body.length*3/4)-padding)};}
export function inspectionPayload(type:InspectionReportType,files:InspectionFiles){const allowed=new Set(allowedInspectionFields(type));return Object.fromEntries(Object.entries(files).filter(([key,value])=>allowed.has(key as InspectionFileField)&&(Array.isArray(value)?value.length:Boolean(value))));}
export function switchInspectionType(type:InspectionReportType,files:InspectionFiles):InspectionFiles{return inspectionPayload(type,files);}

export function validateInspectionFiles(type:InspectionReportType,files:InspectionFiles):string|null {
 const allowed=new Set(allowedInspectionFields(type));let count=0,total=0;
 for(const field of INSPECTION_ALL_FILE_FIELDS){const raw=files[field],values=(Array.isArray(raw)?raw:[raw]).filter((value):value is string=>typeof value==='string'&&value.length>0);if(values.length&&!allowed.has(field))return `${field} is not permitted for ${type==='on_possession'?'possession':'handover'} reports`;
  if(field==='apartmentConditionImages'&&values.length>INSPECTION_FILE_LIMITS.conditionImages)return `Upload at most ${INSPECTION_FILE_LIMITS.conditionImages} condition images`;
  count+=values.length;
  for(const value of values){if(value.startsWith('/api/media/'))continue;const parsed=dataUrlBytes(value);if(!parsed)return 'Attach files using a supported upload';const allowedTypes=field==='apartmentConditionImages'?['image/jpeg','image/png','image/webp']:['image/jpeg','image/png','image/webp','application/pdf'];if(!allowedTypes.includes(parsed.contentType))return 'Only JPEG, PNG, WebP and PDF files are supported';if(parsed.bytes<1||parsed.bytes>INSPECTION_FILE_LIMITS.individualBytes)return 'Each inspection file must be 5 MB or smaller';total+=parsed.bytes;}
 }
 if(count>INSPECTION_FILE_LIMITS.totalFiles)return `Attach at most ${INSPECTION_FILE_LIMITS.totalFiles} files`;
 if(total>INSPECTION_FILE_LIMITS.totalBytes)return 'Inspection attachments must total 25 MB or less';
 return null;
}
