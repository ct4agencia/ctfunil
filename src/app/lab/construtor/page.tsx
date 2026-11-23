import { isRealDataPreview } from "@/lib/workspace-preview";
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import BuilderLab from './BuilderLab';

export const metadata = { title:'CTFunil — laboratório do construtor',robots:{index:false,follow:false} };
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const host = (await headers()).get('host') || '';
  if (!isRealDataPreview(host) && (process.env.NODE_ENV !== "development" || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host))) notFound();
  return <BuilderLab preview={(await searchParams).view==='preview'}/>;
}
