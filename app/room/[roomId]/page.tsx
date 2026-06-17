"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function Room() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const copyToClipboard = (
    setCopyStatus: (status: "idle" | "copied") => void,
  ) => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    
    setCopyStatus("copied");
    setTimeout(() => {
      setCopyStatus("idle");
    }, 2000);
  };

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-semibold uppercase text-zinc-500">
              Room ID
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-green-500">{roomId}</span>
              <button
                onClick={() => copyToClipboard(setCopyStatus)}
                className="uppercase cursor-pointer text-[12px] bg-zinc-800 hover:bg-zinc-700 transition-colors px-2 py-1 rounded text-zinc-400"
              >
                {copyStatus === "copied" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </header>
    </main>
  );
}
