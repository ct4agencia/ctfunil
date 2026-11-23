"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Reload saved local draft intentionally. */
import { useEffect, useState } from 'react';
import CreateFunnelDialog from '@/components/dashboard/CreateFunnelDialog';
import LayersBuilder from '@/components/builder/LayersBuilder';
import LayersRunner from '@/components/quiz/layers/LayersRunner';
import { LocalDraftContext } from '@/components/builder/fields';
import { createLayersFunnel, DEFAULT_CREATION } from '@/lib/quiz/creation';
import { catalogLayer, NEW_COMPONENTS } from '@/lib/quiz/layers/catalog';
import type { Funnel } from '@/lib/quiz/types';
import type { InleadStep } from '@/lib/quiz/layers/types';

const KEY='ctfunil:catalog-lab:v1';
export default function BuilderLab({preview}:{preview:boolean}) {
  const [draft,setDraft]=useState<Funnel|null>(null),[creating,setCreating]=useState(false),[nonce,setNonce]=useState(0),[error,setError]=useState('');
  useEffect(()=>{const frame=window.setTimeout(()=>{try{const saved=localStorage.getItem(KEY);if(saved){const funnel=JSON.parse(saved);if(funnel?.settings?.engine==='layers'&&Array.isArray(funnel.steps))setDraft(funnel);}}catch{setError('Não foi possível ler o rascunho local.');}});return()=>window.clearTimeout(frame);},[]);
  const save=async(funnel:Funnel)=>{try{localStorage.setItem(KEY,JSON.stringify(funnel));return {ok:true};}catch{return {ok:false,error:'Não foi possível salvar neste navegador.'};}};
  const catalog=()=>{
    const funnel=createLayersFunnel({...DEFAULT_CREATION,name:'Catálogo de componentes CT4'},'catalogo-local');
    funnel.steps=NEW_COMPONENTS.map((type,index):InleadStep=>({id:`stage-${index}`,title:type,layers:[catalogLayer(type,`catalog-${index}`)!,{id:`next-${index}`,type:'button',content:{label:'Continuar',destination:'next'}}]})) as unknown as Funnel['steps'];
    setDraft(funnel);setNonce(n=>n+1);
  };
  return <><nav aria-label="Laboratório do construtor" className="ct-workspace flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-ct-line px-5 py-2.5 text-xs"><strong>Laboratório local</strong><button onClick={()=>setCreating(true)}>Criar funil</button><button onClick={catalog}>Abrir catálogo completo</button><a href="/lab/construtor">Construtor</a><a href="/lab/construtor?view=preview">Testar rascunho salvo</a><span>Sem envio de leads ou publicação</span></nav>{error&&<p role="alert">{error}</p>}
    {draft?preview?<LayersRunner key={nonce} funnel={draft} preview/>:<LayersBuilder key={nonce} initial={draft} localDraft={{save,previewHref:'/lab/construtor?view=preview'}}/>:<div className="ct-workspace" style={{padding:48,minHeight:'90vh'}}><h1 style={{fontSize:28}}>Construa seu próximo funil.</h1><p style={{margin:'16px 0'}}>Use a criação guiada ou explore todos os novos componentes.</p><button onClick={()=>setCreating(true)}>Criar primeiro funil →</button></div>}
    {creating&&<LocalDraftContext.Provider value={true}><CreateFunnelDialog onClose={()=>setCreating(false)} onCreate={async input=>{const funnel=createLayersFunnel(input,'rascunho-local');const result=await save(funnel);if(result.ok){setDraft(funnel);setNonce(n=>n+1);setCreating(false);}return result;}}/></LocalDraftContext.Provider>}
  </>;
}
