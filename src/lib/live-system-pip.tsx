import { createContext, useContext, type ReactNode } from "react";

const LiveSystemPipContext = createContext(false);

export function LiveSystemPipProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <LiveSystemPipContext.Provider value={value}>{children}</LiveSystemPipContext.Provider>;
}

export function useLiveSystemPipFlag(): boolean {
  return useContext(LiveSystemPipContext);
}
