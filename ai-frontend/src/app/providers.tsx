"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CreditsProvider } from "@/context/CreditsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <LanguageProvider>
          <CreditsProvider>
            {children}
          </CreditsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Provider>
  );
}
