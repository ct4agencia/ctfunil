"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Layer, LayerAnswer } from "@/lib/quiz/layers/types";
import { componentIdentity, matchesDisplay } from "@/lib/quiz/layers/component-settings";
import { fontFamily, designNumber } from "@/lib/quiz/layers/design";
import "./component-settings.css";

export function interactiveStyles(style: CSSProperties): CSSProperties {
  return { ...style,
    '--control-background': style.background || 'transparent',
    '--control-color': style.color || 'inherit',
    '--control-border': style.borderColor || 'transparent',
    '--control-border-width': typeof style.borderWidth === 'number' ? `${style.borderWidth}px` : style.borderWidth ?? 0,
    '--control-radius': style.borderRadius || 0,
    '--control-shadow': style.boxShadow || 'none',
  } as CSSProperties;
}

export function componentStyles(layer: Layer): CSSProperties {
  const d = layer.design || {};
  const shadow: Record<string,string> = { none: 'none', small: '0 2px 6px #0002', medium: '0 6px 18px #0003', large: '0 12px 32px #0004' };
  const style: Record<string,string|number|undefined> = {
    '--component-font': fontFamily(d.fontFamily),
    '--component-size': d.fontSize == null ? undefined : `${designNumber(d.fontSize,16,10,96)}px`,
    '--component-weight': d.fontWeight,
    '--component-line': d.lineHeight,
    '--component-color': d.textColor,
    '--component-radius': d.cornerRadius == null ? undefined : `${designNumber(d.cornerRadius,8,0,100)}px`,
    '--component-border-width': d.borderWidth == null ? undefined : `${designNumber(d.borderWidth,1,0,12)}px`,
    '--component-shadow': shadow[d.componentShadow],
  };
  for (const state of ['default','hover','active']) for (const key of ['background','color','border']) {
    style[`--component-${state}-${key}`] = d.states?.[state]?.[key];
  }
  return style as CSSProperties;
}

export function ComponentFrame({ layer, answers = {}, fields = {}, editing = false, viewportWidth, children }: {
  layer: Layer; answers?: Record<string,LayerAnswer>; fields?: Record<string,string>; editing?: boolean; viewportWidth?: number; children: ReactNode;
}) {
  const delay = editing ? 0 : designNumber(layer.effects?.starts,0,0,86400);
  const [elapsedDelay, setElapsedDelay] = useState(delay <= 0 ? delay : -1);
  useEffect(() => {
    if (delay <= 0) return;
    const timer = setTimeout(() => setElapsedDelay(delay), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);
  const ready = delay <= 0 || elapsedDelay === delay;
  if (!editing && (layer.design?.hidden || !matchesDisplay(layer,answers,fields))) return null;
  if (!editing && viewportWidth != null && (layer.display?.device === 'mobile' && viewportWidth >= 768 || layer.display?.device === 'desktop' && viewportWidth < 768)) return null;
  if (!ready && !layer.display?.preserveSpace) return null;
  const d = layer.design || {};
  const styled = [d.fontFamily && 'font', d.fontSize != null && 'size', d.fontWeight && 'weight', d.lineHeight && 'line', d.textColor && 'color'].filter(Boolean).join(' ');
  return <div {...componentIdentity(layer)}
    className={`ct-component ${!editing && viewportWidth == null && layer.display?.device ? `ct-device-${layer.display.device}` : ''}`}
    data-typography={styled} data-entrance={!editing && ready ? layer.display?.entrance : undefined}
    data-behavior={!editing && ready ? layer.display?.behavior : undefined}
    data-sticky={layer.type === 'button' && d.stickyFooter && !editing || undefined}
    aria-hidden={!ready || undefined} inert={!ready || undefined}
    style={{ ...componentStyles(layer), visibility: ready ? undefined : 'hidden' }}>
    {children}
  </div>;
}
