import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import { Header } from "./components/Header";
import { Landing } from "./pages/Landing";
import { Workbench } from "./pages/Workbench";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <BrowserRouter>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-cyan-400 focus:text-slate-950 focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
          >
            Skip to main content
          </a>
          <div
            id="app-root"
            style={{ isolation: "isolate" }}
            className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 overflow-x-hidden"
          >
            <Header />
            <main id="main-content" className="flex-1 focus:outline-none">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<Workbench />} />
                <Route path="/workbench" element={<Workbench />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </ErrorBoundary>
  );
};

export default App;
