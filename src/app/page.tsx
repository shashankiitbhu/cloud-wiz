import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import PromptBar from "@/components/PromptBar";
import CanvasPlaceholder from "@/components/CanvasPlaceholder";

export default function Home() {
  return (
    <div className="flex h-full flex-col bg-black">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main canvas area */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <CanvasPlaceholder />
          <PromptBar />
        </main>
      </div>
    </div>
  );
}
