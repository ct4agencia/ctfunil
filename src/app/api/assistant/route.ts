import { ASSISTANT_STREAM_TYPE } from '@/lib/assistant/stream';
import { NextResponse } from 'next/server';
import { isRealDataPreview } from '@/lib/workspace-preview';
import { REQUEST_BYTES_LIMIT } from '@/lib/assistant/messages';
import { requireAdmin } from '@/lib/quiz/admin-guard';
import { assistantConfig, generateGemini, readGeminiReply, requestGemini, validateMessages } from '@/lib/assistant/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = {'Cache-Control':'no-store'};
function providerError(status: number) {
  if (status === 401 || status === 403) return 'A chave Gemini não foi aceita.';
  if (status === 429) return 'Limite da API atingido. Tente novamente mais tarde.';
  if (status === 404) return 'O modelo configurado não está disponível para esta chave.';
  return 'Não foi possível obter uma resposta do Gemini.';
}

function streamReply(body: ReadableStream<Uint8Array>) {
  const reply = readGeminiReply(body);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reply.next();
        controller.enqueue(encoder.encode(JSON.stringify(done ? { done: true } : { text: value }) + '\n'));
        if (done) controller.close();
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'A resposta do Gemini foi interrompida. Tente novamente.' }) + '\n'));
        controller.close();
      }
    },
    async cancel() { await reply.return(undefined); },
  });
  return new Response(stream, {
    headers: { 'Cache-Control': 'no-store, no-transform', 'Content-Type': ASSISTANT_STREAM_TYPE },
  });
}

export async function GET() {
  const auth=await requireAdmin(); if(!auth.ok)return NextResponse.json({error:'Não autorizado.'},{status:401,headers:noStore});
  const config=assistantConfig();
  return NextResponse.json({provider:'Gemini',model:config.model,configured:!!config.key && config.validModel,modelValid:config.validModel},{headers:noStore});
}
export async function POST(request:Request) {
  const auth=await requireAdmin(); if(!auth.ok)return NextResponse.json({error:'Não autorizado.'},{status:401,headers:noStore});
  const origin=request.headers.get('origin');
  const host=request.headers.get('host');
  const expectedOrigin=isRealDataPreview(host) ? `https://${host}` : new URL(request.url).origin;
  if(origin && origin!==expectedOrigin)return NextResponse.json({error:'Origem não permitida.'},{status:403,headers:noStore});
  const config=assistantConfig();
  if(!config.key || !config.validModel)return NextResponse.json({error:'Configure a chave e o modelo Gemini no servidor.'},{status:503,headers:noStore});
  if(Number(request.headers.get('content-length')||0)>REQUEST_BYTES_LIMIT)return NextResponse.json({error:'Mensagem muito longa.'},{status:413,headers:noStore});
  let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'Solicitação inválida.'},{status:400,headers:noStore});}
  const messages=validateMessages((body as {messages?:unknown})?.messages);
  if(!messages)return NextResponse.json({error:'Confira as mensagens e tente novamente.'},{status:400,headers:noStore});
  try {
    if (request.headers.get('accept') === ASSISTANT_STREAM_TYPE) {
      const upstream = await requestGemini(messages, config, fetch, request.signal, true);
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        return NextResponse.json({ error: providerError(upstream.status) }, { status: 502, headers: noStore });
      }
      return streamReply(upstream.body);
    }
    const result = await generateGemini(messages, config, fetch, request.signal);
    if (!result.ok) return NextResponse.json({ error: providerError(result.status) }, { status: 502, headers: noStore });
    return NextResponse.json({text:result.text},{headers:noStore});
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499, headers: noStore });
    return NextResponse.json({error:'Não foi possível conectar ao Gemini. Tente novamente.'},{status:502,headers:noStore});
  }
}
