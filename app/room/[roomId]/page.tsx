"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";

export default function Room() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [message, setMessage] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

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

  const formatTimeRemaining = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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

          <div className="h-14 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-sm text-zinc-500 uppercase">
              Self-Destruct
            </span>
            <span
              className={`font-bold text-xl flex items-center gap-2 ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-green-500"}`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button className="cursor-pointer bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50 uppercase">
          Destroy Room
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"></div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
              {">"}
            </span>
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && message.trim() !== "") {
                  inputRef.current?.focus();
                  setMessage("");
                }
              }}
              className="border border-zinc-800 w-full bg-zinc-900 p-4 pl-10 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 hover:bg-green-600 text-white px-6 py-2 transition-colors uppercase cursor-pointer">
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
