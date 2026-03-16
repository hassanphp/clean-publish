"use client";

import React, { createContext, useContext } from "react";
import { useGetMeQuery } from "@/lib/store/apiSlice";

interface CreditsContextType {
  totalCredits: number;
  loading: boolean;
  refreshCredits: () => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: user, isLoading, refetch } = useGetMeQuery(undefined, {
    skip: typeof window === "undefined",
  });

  const refreshCredits = () => {
    refetch();
  };

  const value: CreditsContextType = {
    totalCredits: user?.credits ?? 0,
    loading: isLoading,
    refreshCredits,
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (!context) throw new Error("useCredits must be used within a CreditsProvider");
  return context;
};
