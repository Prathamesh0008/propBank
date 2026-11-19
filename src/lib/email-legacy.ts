import {renderTransactionalEmail,emailEscape,emailTextFromHtml,type EmailRow} from './email-design';

/** Positional interfaces retained for older callers; identifier-only slots are omitted. */
export const legacyEmailDefinitions:Record<string,{title:string;name:number;message?:number;rows:Array<[string,number,EmailRow['format']?]>}>={
  TenantAdded:{title:'Tenant information updated',name:1,message:2,rows:[['Property',3],['Address',4],['Category',5,'status'],['Recorded monthly rent',6,'money'],['Agreement starts',7],['Agreement ends',8]]},
  PaymentDueUpdate:{title:'Rent due day updated',name:0,rows:[['Property',1],['Rent due day',2],['Address',3]]},
  RentUpdate:{title:'Rental terms updated',name:0,rows:[['Property',1],['Updated monthly rent',2,'money'],['Previous monthly rent',3,'money'],['Address',4]]},
  VisitConfirmation:{title:'Property visit scheduled',name:0,rows:[['Visit',1],['Scheduled',2],['Reminder lead time (minutes)',3],['Reminder channel',4,'status'],['Visit details',5]]},
  GeneralInquiry:{title:'New general enquiry',name:-1,rows:[['Customer',0],['Email',1],['Phone',2],['Purpose',3,'status'],['Category',4,'status'],['Visit preference',5],['Message',6]]},
  AgreementNotice:{title:'Agreement notice',name:1,message:2,rows:[['Property',3],['Address',4],['Unit',5],['Floor',6],['Category',7,'status'],['Configuration',8],['Carpet area',9],['Recorded monthly rent',10,'money'],['Notice effective date',11],['Initiated by',12]]},
  AgreementTermination:{title:'Agreement termination',name:1,message:2,rows:[['Effective date',3],['Reason',4],['Initiated by',5],['Property',6],['Address',7],['Unit',8],['Floor',9],['Category',10,'status'],['Configuration',11],['Carpet area',12],['Recorded monthly rent',13,'money'],['Agreement starts',14],['Agreement ends',15]]},
  TerminationRequestOwner:{title:'Agreement termination requested',name:0,rows:[['Tenant',1],['Property',2],['Requested notice period',3]]},
  TerminationRequestTenant:{title:'Termination request received',name:0,rows:[['Property',1],['Requested notice period',2],['Owner',3]]},
  RenewalRequestOwner:{title:'Agreement renewal requested',name:0,rows:[['Tenant',1],['Property',2]]},
  RenewalRequestTenant:{title:'Renewal request received',name:0,rows:[['Property',1],['Owner',2]]},
};
export function renderLegacyEmail(key:string,values:Array<string|{readonly __trustedTemplateHtml:string}>){
  const definition=legacyEmailDefinitions[key];if(!definition)return null;
  const value=(index:number)=>typeof values[index]==='string'?values[index] as string:'';
  // Trusted fragments were used for bold text only; never move arbitrary markup into summaries.
  const fragment=definition.message!==undefined?values[definition.message]:undefined;
  const message=definition.message!==undefined?(typeof fragment==='string'?fragment:fragment?emailTextFromHtml(fragment.__trustedTemplateHtml):'')||'Your property information has been updated. Review the details in PropBank.':'Review the recorded details below. Open PropBank for the latest information and any required next steps.';
  return renderTransactionalEmail(definition.title,`<p>${emailEscape(message)}</p>`,message,undefined,{greeting:definition.name<0?'PropBank team':value(definition.name),rows:definition.rows.map(([label,index,format])=>({label,value:value(index),format})),nextStep:key.includes('Request')?'A request is not a completed agreement change. Review its status in PropBank.':undefined});
}
