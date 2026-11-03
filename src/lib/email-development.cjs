// Pure development-email policy shared by the launcher and server transport.
const {firebaseEnvironment}=require('./firebase-environment.cjs');
function address(value){
  if(typeof value!=='string'||/[\x00-\x20\x7f,;<>"\\]/.test(value))return null;
  const email=value.toLowerCase();
  if(email.includes('*'))return null;
  if(email.length>254)return null;
  const parts=email.split('@');if(parts.length!==2)return null;
  const [local,domain]=parts;
  if(!local||local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local))return null;
  const labels=domain.split('.');if(labels.length<2||labels.some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))return null;
  return email;
}
function developmentEmailConfiguration(env){
  firebaseEnvironment(env);
  const mode=env.PROPBANK_EMAIL_MODE||'capture';
  if(!['capture','resend-test'].includes(mode))throw new Error('PROPBANK_EMAIL_MODE must be capture or resend-test.');
  if(mode==='capture')return {mode,allowlist:[]};
  if(env.PROPBANK_FIREBASE_MODE!=='firebase'||env.NODE_ENV!=='development'||env.FIREBASE_DEV_PROJECT_ID!=='propbanktest')throw new Error('resend-test requires isolated propbanktest development mode.');
  const raw=env.PROPBANK_EMAIL_ALLOWLIST||'';
  const allowlist=raw.split(',').map(value=>address(value.trim()));
  if(!raw||allowlist.length>5||allowlist.some(value=>!value))throw new Error('resend-test requires 1 to 5 exact development addresses in PROPBANK_EMAIL_ALLOWLIST; wildcards are forbidden.');
  if(!env.RESEND_API_KEY?.trim())throw new Error('resend-test requires an explicit development RESEND_API_KEY.');
  if(!address(env.FROM_EMAIL||'')||env.PROPBANK_EMAIL_SENDER_VERIFIED!=='1')throw new Error('resend-test requires FROM_EMAIL and explicit PROPBANK_EMAIL_SENDER_VERIFIED=1 confirmation from the Resend dashboard.');
  if(env.ADMIN_EMAIL&&!allowlist.includes(address(env.ADMIN_EMAIL)))throw new Error('Development ADMIN_EMAIL must be explicitly allowlisted.');
  return {mode,allowlist:[...new Set(allowlist)]};
}
function authorizeDevelopmentEmail(env,mail){
  const config=developmentEmailConfiguration(env);
  if(!mail||typeof mail!=='object'||Array.isArray(mail))throw new Error('Development batch/bulk email is forbidden.');
  if(config.mode==='capture')return {mode:config.mode};
  const recipients={};let total=0;
  for(const field of ['to','cc','bcc']){
    const value=mail[field];
    if(value===undefined&&field!=='to')continue;
    const list=Array.isArray(value)?value:[value];
    if(!list.length)throw new Error('Development email requires explicit recipients.');
    recipients[field]=list.map(value=>address(value));total+=list.length;
    if(recipients[field].some(value=>!value||!config.allowlist.includes(value)))throw new Error('Development email blocked: every To, CC and BCC must exactly match the approved allowlist.');
  }
  if(total>3)throw new Error('Development bulk email is forbidden: at most 3 total To/CC/BCC recipients per message.');
  if(mail.scheduled_at||mail.scheduledAt)throw new Error('Scheduled development email is forbidden.');
  return {mode:config.mode,...recipients};
}
module.exports={address,developmentEmailConfiguration,authorizeDevelopmentEmail};
