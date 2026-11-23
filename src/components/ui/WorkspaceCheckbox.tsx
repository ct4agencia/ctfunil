"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Check, Minus } from "lucide-react";

type WorkspaceCheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & { mixed?: boolean };

export default function WorkspaceCheckbox({ mixed = false, ...props }: WorkspaceCheckboxProps) {
  return <span className="ct-selection-checkbox">
    <input {...props} type="checkbox" ref={input => { if (input) input.indeterminate = mixed; }} />
    <span className="ct-selection-mark" aria-hidden="true">
      <Check className="ct-selection-check" size={14} />
      <Minus className="ct-selection-dash" size={14} />
    </span>
  </span>;
}
