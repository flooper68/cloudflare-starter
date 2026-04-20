import { createContext, type ReactNode, useContext, useState } from "react";

export interface AuthContextValue {
  readonly userId: string | null;
}

interface AuthScriptData {
  readonly userId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAuthScript(): AuthScriptData {
  const element = document.getElementById("__APP_AUTH__");
  if (!element?.textContent) {
    throw new Error("Missing __APP_AUTH__ script tag");
  }

  return JSON.parse(element.textContent) as AuthScriptData;
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [data] = useState(readAuthScript);

  return (
    <AuthContext.Provider value={{ userId: data.userId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
