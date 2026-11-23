"use client";

import type { ReactNode } from "react";
import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/referencias/beui/motion/file-tree";

type Branch = { folders: Map<string, Branch>; files: { name: string; path: string }[] };

function branch(): Branch {
  return { folders: new Map(), files: [] };
}

function buildTree(paths: string[]) {
  const tree = branch();
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    const name = path.endsWith("/") ? undefined : parts.pop();
    let cursor = tree;
    for (const part of parts) {
      if (!cursor.folders.has(part)) cursor.folders.set(part, branch());
      cursor = cursor.folders.get(part)!;
    }
    if (name) cursor.files.push({ name, path });
  }
  return tree;
}

function treeItems(node: Branch, selectable: Set<string>, prefix = ""): ReactNode[] {
  return [
    ...Array.from(node.folders, ([name, child]) => {
      const path = prefix + name + "/";
      return <FileTreeFolder key={path} value={path} name={name}>
        {treeItems(child, selectable, path)}
      </FileTreeFolder>;
    }),
    ...node.files.map(({ name, path }) =>
      <FileTreeFile key={path} value={path} name={name} disabled={!selectable.has(path)} />),
  ];
}

export default function ProjectFileTree({ paths, pages, selected, onSelect }: {
  paths: string[];
  pages: string[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  const selectable = new Set(pages);
  return <details className="ct-file-tree">
    <summary>Arquivos encontrados</summary>
    <FileTree ariaLabel="Arquivos do anexo" value={selected} indent={14}
      onValueChange={path => { if (selectable.has(path)) onSelect(path); }}
      className="ct-file-tree-rows" classNames={{ item: "ct-file-tree-row" }}>
      {treeItems(buildTree(paths), selectable)}
    </FileTree>
  </details>;
}
