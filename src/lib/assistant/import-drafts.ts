import type { Funnel } from '@/lib/quiz/types';
export interface ImportDraft { id:string; funnel:Funnel; warnings:string[]; source:string; reviewed?:boolean; }
function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const request=indexedDB.open('ctfunil-importacoes',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function saveImportDraft(draft:ImportDraft):Promise<void> {
  const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function loadImportDraft(id:string):Promise<ImportDraft|undefined> {
  const db=await open();try{return await new Promise((resolve,reject)=>{const request=db.transaction('drafts','readonly').objectStore('drafts').get(id);request.onsuccess=()=>resolve(request.result as ImportDraft|undefined);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
