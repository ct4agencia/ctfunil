"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";
import { workspaceReturnPath } from "@/lib/workspace-return";

type AccessLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: "/admin/login" | "/auth/recover" | "/auth/update-password";
  fallbackDestination?: string;
};

function AccessLinkWithDestination({ href, fallbackDestination, ...props }: AccessLinkProps) {
  const searchParams = useSearchParams();
  const destination = workspaceReturnPath(searchParams.get("next") ?? fallbackDestination ?? null);
  const url = destination === "/dashboard" ? href : `${href}?${new URLSearchParams({ next: destination })}`;
  return <a href={url} {...props} />;
}

export function AccessLink({ fallbackDestination, ...props }: AccessLinkProps) {
  return <Suspense fallback={<span role="link" aria-disabled="true" className={props.className}>{props.children}</span>}>
    <AccessLinkWithDestination {...props} fallbackDestination={fallbackDestination} />
  </Suspense>;
}
