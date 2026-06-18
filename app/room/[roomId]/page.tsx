"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRealtime } from "@upstash/realtime/client";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Room() {
  const params = useParams();
  const router = useRouter();
  const { username } = useUsername();
  const roomId = params.roomId as string;

  const [message, setMessage] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const response = await client.rooms.ttl.get({ query: { roomId } });
      return response.data;
    },
  });

  useEffect(() => {
    if (ttlData?.ttl !== undefined) setTimeRemaining(ttlData.ttl);
  }, [ttlData]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;

    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, router]);

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

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const response = await client.messages.get({ query: { roomId } });
      return response.data;
    },
  });

  const {
    mutate: sendMessage,
    isPending: isSendingMessage,
    error: sendMessageError,
  } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const response = await client.messages.post(
        {
          sender: username,
          text,
        },
        { query: { roomId } },
      );

      if (response.status !== 200) {
        throw new Error("Message was not sent.");
      }
    },
    onSuccess: () => {
      inputRef.current?.focus();
      setMessage("");
    },
  });

  const {
    mutate: destroyRoom,
    isPending: isDestroyingRoom,
    error: destroyRoomError,
  } = useMutation({
    mutationFn: async () => {
      const response = await client.rooms.delete(null, { query: { roomId } });

      if (response.status !== 200) {
        throw new Error("Room was not destroyed.");
      }
    },
  });

  const handleSendMessage = () => {
    if (message.trim() === "" || isSendingMessage) return;
    sendMessage({ text: message });
  };

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event == "chat.message") {
        refetch();
      } else if (event == "chat.destroy") {
        router.push("/?destroyed=true");
      }
    },
  });

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

        <button
          onClick={() => destroyRoom()}
          disabled={isDestroyingRoom}
          className="cursor-pointer bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50 uppercase"
        >
          {isDestroyingRoom ? "Destroying..." : "Destroy Room"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {destroyRoomError && (
          <p className="text-red-400 text-sm text-center">
            {destroyRoomError.message}
          </p>
        )}

        {messages?.messages.length === 0 ? (
          <p className="text-zinc-500 text-center flex justify-center items-center h-full">
            No messages in this room yet.
          </p>
        ) : (
          messages?.messages.map((msg) => (
            <div key={msg.id} className="flex flex-col items-start">
              <div className="max-w-[80%] group">
                <div className="flex items-baseline gap-3 mb-1">
                  {/* complete the logic in the below line */}
                  <span
                    className={`text-sm font-bold ${msg.sender === username ? "text-green-500" : "text-zinc-500"}`}
                  >
                    {msg.sender == username ? "YOU" : msg.sender}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {format(msg.timestamp, "hh:mm a")}
                  </span>
                </div>

                <p className="text-zinc-200 text-base leading-relaxed break-all">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

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
                  handleSendMessage();
                }
              }}
              className="border border-zinc-800 w-full bg-zinc-900 p-4 pl-10 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={message.trim() === "" || isSendingMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 hover:bg-green-600 text-white px-6 py-2 transition-colors uppercase cursor-pointer"
            >
              {isSendingMessage ? "Sending" : "Send"}
            </button>
          </div>
        </div>

        {sendMessageError && (
          <p className="mt-2 text-sm text-red-400">
            {sendMessageError.message}
          </p>
        )}
      </div>
    </main>
  );
}
