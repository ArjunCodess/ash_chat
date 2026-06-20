"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import {
  decryptMessageText,
  encryptMessageText,
  importRoomKey,
  readRoomKeyFromHash,
} from "@/lib/crypto";
import { useRealtime } from "@/lib/realtime-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const copyToClipboard = (setCopyStatus: (status: "idle" | "copied") => void) => {
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

type EncryptedMessage = {
  ciphertext: string;
  id: string;
  iv: string;
  roomId: string;
  sender: string;
  timestamp: number;
  token?: string;
};

function MessageItem({
  message,
  roomId,
  roomKey,
}: {
  message: EncryptedMessage;
  roomId: string;
  roomKey: CryptoKey;
}) {
  const [decryptedText, setDecryptedText] = useState("Decrypting...");
  const isOwnMessage = message.token !== undefined;

  useEffect(() => {
    let isActive = true;

    decryptMessageText({
      ciphertext: message.ciphertext,
      iv: message.iv,
      key: roomKey,
      roomId,
    })
      .then((text) => {
        if (isActive) setDecryptedText(text);
      })
      .catch(() => {
        if (isActive) setDecryptedText("Unable to decrypt message");
      });

    return () => {
      isActive = false;
    };
  }, [message.ciphertext, message.iv, roomId, roomKey]);

  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[80%] group">
        <div className="flex items-baseline gap-3 mb-1">
          <span
            className={`text-sm font-bold ${isOwnMessage ? "text-green-500" : "text-zinc-500"}`}
          >
            {isOwnMessage ? "YOU" : message.sender}
          </span>
          <span className="text-xs text-zinc-500">
            {format(message.timestamp, "hh:mm a")}
          </span>
        </div>

        <p className="text-zinc-200 text-base leading-relaxed break-all">
          {decryptedText}
        </p>
      </div>
    </div>
  );
}

export default function Room() {
  const params = useParams();
  const router = useRouter();
  const { username } = useUsername();
  const queryClient = useQueryClient();
  const roomId = params.roomId as string;

  const [message, setMessage] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [keyStatus, setKeyStatus] = useState<
    "invalid" | "loading" | "missing" | "ready"
  >("loading");
  const [now, setNow] = useState(() => Date.now());
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isActive = true;

    const loadRoomKey = async () => {
      const encodedKey = readRoomKeyFromHash();

      if (!encodedKey) {
        setRoomKey(null);
        setKeyStatus("missing");
        return;
      }

      try {
        const importedKey = await importRoomKey(encodedKey);
        if (!isActive) return;

        setRoomKey(importedKey);
        setKeyStatus("ready");
      } catch {
        if (!isActive) return;

        setRoomKey(null);
        setKeyStatus("invalid");
      }
    };

    loadRoomKey();
    window.addEventListener("hashchange", loadRoomKey);

    return () => {
      isActive = false;
      window.removeEventListener("hashchange", loadRoomKey);
    };
  }, []);

  const { data: ttlData, dataUpdatedAt: ttlUpdatedAt } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const response = await client.rooms.ttl.get({ query: { roomId } });
      return response.data;
    },
  });

  const timeRemaining =
    ttlData?.ttl !== undefined && ttlUpdatedAt > 0
      ? Math.max(0, Math.ceil((ttlUpdatedAt + ttlData.ttl * 1000 - now) / 1000))
      : null;

  useEffect(() => {
    if (ttlData?.ttl === undefined) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [ttlData?.ttl]);

  useEffect(() => {
    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
    }
  }, [timeRemaining, router]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const response = await client.messages.get({ query: { roomId } });
      return response.data;
    },
    refetchInterval: 2000,
  });

  const {
    mutate: sendMessage,
    isPending: isSendingMessage,
    error: sendMessageError,
  } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!roomKey) {
        throw new Error("This room link is missing its encryption key.");
      }

      const encryptedMessage = await encryptMessageText({
        key: roomKey,
        roomId,
        text,
      });

      const response = await client.messages.post(
        {
          ...encryptedMessage,
          sender: username,
        },
        { query: { roomId } },
      );

      if (response.status !== 200) {
        throw new Error("Message was not sent.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ttl", roomId] }),
        queryClient.invalidateQueries({ queryKey: ["messages", roomId] }),
      ]);
    },
  });

  const handleSendMessage = () => {
    if (message.trim() === "" || isSendingMessage || !roomKey) return;
    sendMessage({ text: message });
  };

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ data, event }) => {
      if (event == "chat.message") {
        const incomingMessage = { ...data, token: undefined };

        queryClient.setQueryData<typeof messages>(["messages", roomId], (current) => {
          if (!current) return { messages: [incomingMessage] };
          if (current.messages.some((msg) => msg.id === incomingMessage.id)) return current;

          return {
            ...current,
            messages: [...current.messages, incomingMessage],
          };
        });
        refetch();
      } else if (event == "chat.destroy") {
        router.push("/?destroyed=true");
      }
    },
  });

  if (keyStatus !== "ready" || !roomKey) {
    const message =
      keyStatus === "invalid"
        ? "This room link has an invalid encryption key."
        : keyStatus === "missing"
          ? "This room link is missing its encryption key."
          : "Loading room encryption key...";

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="w-full max-w-md border border-zinc-800 bg-zinc-900/50 p-6">
          <h1 className="text-xl font-bold text-green-500">ash_chat</h1>
          <p className="mt-3 text-sm text-zinc-400">{message}</p>
          <p className="mt-3 text-xs text-zinc-600">
            Ask the room creator to send the full invite link, including the
            part after #.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-3 sm:p-4 flex flex-col gap-3 bg-zinc-900/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
          <div className="min-w-0 flex flex-col">
            <span className="font-semibold uppercase text-zinc-500">
              Room ID
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-bold text-base text-green-500 sm:text-xl">
                {roomId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(setCopyStatus)}
                className="uppercase cursor-pointer text-[12px] bg-zinc-800 hover:bg-zinc-700 transition-colors px-2 py-1 rounded text-zinc-400"
              >
                {copyStatus === "copied" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="hidden h-14 w-px bg-zinc-800 sm:block" />

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
          type="button"
          onClick={() => destroyRoom()}
          disabled={isDestroyingRoom}
          className="w-full justify-center cursor-pointer bg-zinc-800 hover:bg-red-600 px-3 py-2 rounded text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50 uppercase sm:w-auto sm:py-1.5"
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
            <MessageItem
              key={msg.id}
              message={msg}
              roomId={roomId}
              roomKey={roomKey}
            />
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
              aria-label="Message"
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
              type="button"
              onClick={handleSendMessage}
              disabled={message.trim() === "" || isSendingMessage || !roomKey}
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
