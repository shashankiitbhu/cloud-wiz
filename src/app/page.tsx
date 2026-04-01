"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import PromptBar from "@/components/PromptBar";
import Canvas from "@/components/Canvas";

export default function Home() {
  return (
    <div className="flex h-full flex-col bg-black">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <Canvas />
          <PromptBar />
        </main>
      </div>
    </div>
  );
}
