"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Sidebar, { type SidebarPanel } from "@/components/Sidebar";
import PromptBar from "@/components/PromptBar";
import Canvas from "@/components/Canvas";
import ExportPanel from "@/components/ExportPanel";
import ChaosReport from "@/components/ChaosReport";
import SaveLoadPanel from "@/components/SaveLoadPanel";
import CostPanel from "@/components/CostPanel";
import CompliancePanel from "@/components/CompliancePanel";
import SyncPanel from "@/components/SyncPanel";
import ConstraintModal from "@/components/ConstraintModal";
import ContainerizerModal from "@/components/ContainerizerModal";
import CombinedFlowModal from "@/components/CombinedFlowModal";
import ImportModal from "@/components/ImportModal";
import TemplatesModal from "@/components/TemplatesModal";

export default function Home() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [containerizerOpen, setContainerizerOpen] = useState(false);
  const [combinedFlowOpen, setCombinedFlowOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-black">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onOpenImport={() => setImportOpen(true)}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenContainerizer={() => setContainerizerOpen(true)}
          onOpenCombinedFlow={() => setCombinedFlowOpen(true)}
        />

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <Canvas
            onOpenTemplates={() => setTemplatesOpen(true)}
            onOpenContainerizer={() => setContainerizerOpen(true)}
            onOpenImport={() => setImportOpen(true)}
            onOpenCombinedFlow={() => setCombinedFlowOpen(true)}
          />
          <PromptBar />
        </main>

        {/* Side panels — only one at a time */}
        <ExportPanel
          open={activePanel === "export"}
          onClose={() => setActivePanel(null)}
        />
        <SaveLoadPanel
          open={activePanel === "save"}
          onClose={() => setActivePanel(null)}
        />
        <CostPanel
          open={activePanel === "cost"}
          onClose={() => setActivePanel(null)}
        />
        <CompliancePanel
          open={activePanel === "compliance"}
          onClose={() => setActivePanel(null)}
        />
        <SyncPanel
          open={activePanel === "github"}
          onClose={() => setActivePanel(null)}
        />
        <ChaosReport />
      </div>

      {/* Modals */}
      <ConstraintModal />
      <ContainerizerModal open={containerizerOpen} onClose={() => setContainerizerOpen(false)} />
      <CombinedFlowModal open={combinedFlowOpen} onClose={() => setCombinedFlowOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </div>
  );
}
