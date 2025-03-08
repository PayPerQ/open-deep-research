"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface CreditIdContextType {
  creditId: string | null;
}

const CreditIdContext = createContext<CreditIdContextType | undefined>(undefined);

export function CreditIdProvider({ children }: { children: React.ReactNode }) {
  const [creditId, setCreditId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem("credit_id");
      setCreditId(id);
    } catch (error) {
      console.error("[CREDIT ID] Could not access localStorage:", error);
    }
  }, []);

  const value = React.useMemo(() => ({ creditId }), [creditId]);

  return React.createElement(CreditIdContext.Provider, { value }, children);
}

export function useCreditId(): string | null {
  const context = useContext(CreditIdContext);
  if (context === undefined) {
    throw new Error("useCreditId must be used within a CreditIdProvider");
  }
  return context.creditId;
}
