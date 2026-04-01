"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import PromptBar from "@/components/PromptBar";
import Canvas from "@/components/Canvas";
import ExportPanel from "@/components/ExportPanel";
import ChaosReport from "@/components/ChaosReport";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-black">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onToggleExport={() => setExportOpen((v) => !v)}
          exportOpen={exportOpen}
        />

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <Canvas />
          <PromptBar />
        </main>

        <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
        <ChaosReport />
      </div>
    </div>
  );
}
