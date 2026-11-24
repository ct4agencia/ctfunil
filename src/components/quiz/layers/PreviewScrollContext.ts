import { createContext, type RefObject } from "react";

export const PreviewScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
