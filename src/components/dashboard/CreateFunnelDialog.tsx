"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FilePlus2, X } from 'lucide-react';
import { CREATION_TEMPLATES, DEFAULT_CREATION, creationError, type CreationInput } from '@/lib/quiz/creation';
import { funnelFontClasses } from '@/components/quiz/layers/fonts';
import { FUNNEL_FONTS, fontFamily } from '@/lib/quiz/layers/design';
import { ImageField } from '@/components/builder/fields';
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import ColorField from '@/components/ui/ColorField';
import './creation.css';

export default function CreateFunnelDialog({onClose,onCreate}:{onClose:()=>void;onCreate:(input:CreationInput)=>Promise<{ok:boolean;error?:string}>}) {
  const [input,setInput]=useState<CreationInput>({...DEFAULT_CREATION});
  const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  const patch=(values:Partial<CreationInput>)=>setInput(previous=>({...previous,...values}));
  const submit=async()=>{const invalid=creationError(input);if(invalid){setError(invalid);return;}setBusy(true);setError('');try{const result=await onCreate(input);if(!result.ok)setError(result.error||'Não foi possível criar o funil.');}catch{setError('Não foi possível criar. Tente novamente.');}finally{setBusy(false);}};
  return <dialog ref={dialog} className={`ct-workspace ct-create-dialog ${funnelFontClasses}`} aria-labelledby="create-funnel-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header><span><FilePlus2 size={17}/> Novo funil</span><button aria-label="Fechar criação" disabled={busy} onClick={onClose}><X size={19}/></button></header>
    <div className="ct-create-body">
      <ol className="ct-create-progress">{['Estrutura','Identidade','Objetivo'].map((label,index)=><li key={label} aria-current={step===index?'step':undefined}><span>{step>index?<Check size={13}/>:index+1}</span>{label}</li>)}</ol>
      <h2 id="create-funnel-title">{['Como você quer começar?','Dê a sua identidade ao funil.','Pronto para construir.'][step]}</h2>
      <p className="ct-create-intro">{['Escolha uma base. Todos os componentes estarão disponíveis para editar.','Logo, cores e fontes podem ser ajustados depois na aba Design.','Defina o objetivo e revise sua estrutura antes de abrir o construtor.'][step]}</p>
      {step===0&&<><label>Nome do funil<input autoFocus maxLength={120} value={input.name} placeholder="Ex.: Diagnóstico do meu produto" onChange={e=>patch({name:e.target.value})}/></label><div className="ct-create-templates">{CREATION_TEMPLATES.map(template=><button key={template.id} aria-pressed={input.template===template.id} onClick={()=>patch({template:template.id})}><strong>{template.name}</strong><span>{template.description}</span></button>)}</div></>}
      {step===1&&<><label>Logo (opcional)</label><ImageField value={input.logo||''} onChange={logo=>patch({logo})}/><div className="ct-create-colors">{([['backgroundColor','Fundo'],['themeColor','Destaque'],['titleColor','Títulos'],['contentColor','Textos']] as const).map(([key,label])=><div key={key}><span>{label}</span><ColorField className="h-8 w-10" label={label} value={input[key]} onChange={color=>patch({[key]:color})}/></div>)}</div><div className="ct-create-pair">{(['titleFont','contentFont'] as const).map((key,i)=><label key={key}>{i?'Fonte dos textos':'Fonte dos títulos'}<WorkspaceSelect label={i?'Fonte dos textos':'Fonte dos títulos'} value={input[key]} onChange={value=>patch({[key]:value})} options={FUNNEL_FONTS.map(font=>({value:font,label:font}))}/></label>)}</div><div className="ct-create-sample" style={{background:input.backgroundColor,color:input.contentColor,fontFamily:fontFamily(input.contentFont)}}><h3 style={{color:input.titleColor,fontFamily:fontFamily(input.titleFont)}}>Sua próxima experiência começa aqui.</h3><p>Uma conversa com o seu público, etapa por etapa.</p><span style={{background:input.themeColor}}>Continuar <ArrowRight size={14}/></span></div></>}
      {step===2&&<><div className="ct-create-pair"><label>Objetivo<WorkspaceSelect label="Objetivo" value={input.objective} onChange={value=>patch({objective:value})} options={['Capturar leads','Vender um produto','Agendar uma conversa','Conhecer o público','Receber inscrições'].map(value=>({value,label:value}))}/></label><label>Tom de comunicação<WorkspaceSelect label="Tom de comunicação" value={input.tone} onChange={value=>patch({tone:value})} options={['Amigável','Formal','Criativo','Inspirador','Neutro'].map(value=>({value,label:value}))}/></label></div><p className="ct-create-note">Estas informações ficam nas configurações do funil para orientar a edição dos seus textos.</p><div className="ct-create-review"><strong>{input.name}</strong><span>{CREATION_TEMPLATES.find(t=>t.id===input.template)?.name}</span><p>Componentes, respostas, conexões entre etapas e identidade visual em um único construtor.</p></div></>}
      {error&&<p className="ct-create-error" role="alert">{error}</p>}
    </div>
    <footer><button disabled={busy} onClick={()=>{if(step){setStep(step-1);setError('');}else onClose();}}><ArrowLeft size={15}/>{step?'Voltar':'Cancelar'}</button><button className="ct-create-primary" disabled={busy||!input.name.trim()} onClick={()=>{if(step<2){setStep(step+1);setError('');}else void submit();}}>{busy?'Criando…':step===2?'Criar e abrir construtor':'Continuar'}<ArrowRight size={15}/></button></footer>
  </dialog>;
}
