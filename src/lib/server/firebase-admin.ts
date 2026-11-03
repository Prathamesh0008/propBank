import 'server-only';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {firebaseEnvironment} from '../firebase-environment.cjs';

function credential(value:string|undefined,variable:string,projectId:string) {
  const configured=value?.trim();
  if(!configured)return applicationDefault();
  let account:ServiceAccount & {project_id?:string};
  try {
    account=JSON.parse(configured.startsWith('{')?configured:readFileSync(resolve(configured),'utf8'));
    if(!account||typeof account!=='object'||Array.isArray(account))throw new Error('Invalid account');
  } catch {
    throw new Error(`${variable} must contain valid service-account JSON or a readable JSON file path.`);
  }
  if((account.project_id||account.projectId)!==projectId)throw new Error(`${variable} service-account project does not match its configured Firebase project.`);
  if(process.env.PROPBANK_FIREBASE_MODE==='firebase'){
    const identity=account as ServiceAccount & {client_email?:string;private_key?:string;type?:string};
    if(identity.type!=='service_account'||!(identity.client_email||identity.clientEmail||'').endsWith(`@${projectId}.iam.gserviceaccount.com`)||!(identity.private_key||identity.privateKey))throw new Error('Development service-account identity must belong to the development project.');
  }
  return cert(account);
}

// Auth and data are separate existing projects. Lazy initialization keeps builds,
// public data reads and Go proxying independent of Auth credentials.
export function getFirebaseAuthAdminApp() {
  const environment=firebaseEnvironment(process.env);
  const projectId=environment.authProjectId;
  const browserProject=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if(browserProject&&browserProject!==projectId)throw new Error('Browser Firebase project must match FIREBASE_AUTH_PROJECT_ID.');
  const existing=getApps().find(app=>app.name==='propbank-auth');
  if(existing){if(existing.options.projectId!==projectId)throw new Error('Firebase Auth project changed; restart the server.');return existing;}
  return initializeApp({projectId,...(environment.mode==='emulator'?{}:{credential:credential(process.env.FIREBASE_AUTH_CREDENTIALS,'FIREBASE_AUTH_CREDENTIALS',projectId)})},'propbank-auth');
}

export function getFirebaseDataAdminApp() {
  const environment=firebaseEnvironment(process.env);
  const projectId=environment.dataProjectId;
  const existing=getApps().find(app=>app.name==='propbank-data');
  if(existing){if(existing.options.projectId!==projectId)throw new Error('Firebase Data project changed; restart the server.');return existing;}
  return initializeApp({projectId,...(environment.mode==='emulator'?{}:{credential:credential(process.env.FIREBASE_DATA_CREDENTIALS?.trim()||process.env.FIREBASE_CREDENTIALS,'FIREBASE_DATA_CREDENTIALS (or legacy FIREBASE_CREDENTIALS)',projectId),storageBucket:process.env.FIREBASE_DATA_STORAGE_BUCKET||process.env.STORAGE_BUCKET||process.env.FIREBASE_STORAGE_BUCKET})},'propbank-data');
}

// Backward-compatible alias: old server consumers refer only to DATA.
export const getFirebaseAdminApp=getFirebaseDataAdminApp;
export function getFirebaseAdminAuth(){return getAuth(getFirebaseAuthAdminApp());}
export function getFirebaseAdminFirestore(){const app=getFirebaseDataAdminApp();return firebaseEnvironment(process.env).mode==='firebase'?getFirestore(app,'(default)'):getFirestore(app);}
export function getFirebaseAdminStorage() {
  if(firebaseEnvironment(process.env).mode==='firebase')throw new Error('Legacy storage is disabled in Firebase development mode. Use isolated file mocks.');
  if(firebaseEnvironment(process.env).mode==='emulator')throw new Error('Legacy Cloud Storage is disabled in emulator mode. No live uploads or downloads are permitted.');
  const bucket=process.env.FIREBASE_DATA_STORAGE_BUCKET||process.env.STORAGE_BUCKET||process.env.FIREBASE_STORAGE_BUCKET;
  if(!bucket)throw new Error('Configure FIREBASE_DATA_STORAGE_BUCKET or the existing server STORAGE_BUCKET before using legacy property image storage.');
  return getStorage(getFirebaseDataAdminApp());
}
