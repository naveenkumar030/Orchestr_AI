import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#D97757]/6 blur-3xl" />
        <div className="absolute top-1/4 -right-40 w-96 h-96 rounded-full bg-[#B87A36]/6 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-[#D97757]/5 blur-3xl" />
      </div>

      <Sidebar />
      <Header />

      <div className="pl-72 flex flex-col min-h-screen relative z-10">
        <main className="w-full pt-20 pb-12 px-space-lg bg-transparent flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
