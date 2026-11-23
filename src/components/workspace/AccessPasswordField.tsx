"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import "./access-form.css";

export function AccessPasswordField({ label, ...input }: Omit<ComponentPropsWithRef<"input">, "type"> & { label: string }) {
  const [visible, setVisible] = useState(false);

  return <>
    <label htmlFor={input.id}>{label}</label>
    <div className="ct-login-field">
      <LockKeyhole className="ct-login-symbol" aria-hidden="true" />
      <input {...input} type={visible ? "text" : "password"} />
      <button type="button" className="ct-login-eye" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLocaleLowerCase("pt-BR")}`}
        aria-controls={input.id} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  </>;
}
