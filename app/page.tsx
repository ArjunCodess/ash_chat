"use client";

import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ashchat_username";

const generateUsername = () => {
  const adjectives = ["Swift", "Silent", "Brave", "Clever", "Mighty"];
  const nouns = ["Tiger", "Eagle", "Shark", "Panther", "Wolf"];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective}${noun}`;
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomTTLSeconds, setRoomTTLSeconds] = useState(3600);

  useEffect(() => {
    const main = () => {
      let storedUsername = localStorage.getItem(STORAGE_KEY);
      if (!storedUsername) {
        storedUsername = generateUsername();
        localStorage.setItem(STORAGE_KEY, storedUsername);
      }
      setUsername(storedUsername);
    };

    main();
  }, []);

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const response = await client.rooms.create.post({ roomTTLSeconds });
      console.log("Room created:", response);
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-green-500">
            ash_chat
          </h1>
          <p className="text-zinc-500 text-sm text-balance">
            a private, end-to-end encrypted, self-destructing chat app.
          </p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-400">
                  {username}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Time to Live (TTL) in seconds
              </label>

              <input
                type="number"
                className="w-full bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-400"
                value={roomTTLSeconds}
                onChange={(e) => setRoomTTLSeconds(parseInt(e.target.value) || 3600)}
                required
              />
            </div>

            <button
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors mt-2 cursor-pointer disabled:opacity-50"
              onClick={() => createRoom()}
            >
              CREATE SECURE ROOM
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
