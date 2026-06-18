"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const MIN_ROOM_TTL_SECONDS = 60;
const DEFAULT_ROOM_TTL_SECONDS = 3600;
const MAX_ROOM_TTL_SECONDS = 24 * 60 * 60;

export default function Home() {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  );
}

function Lobby() {
  const [roomTTLSeconds, setRoomTTLSeconds] = useState(
    DEFAULT_ROOM_TTL_SECONDS,
  );

  const { username } = useUsername();
  const router = useRouter();

  const searchParams = useSearchParams();
  const wasDestroyed = searchParams.get("destroyed") === "true";
  const error = searchParams.get("error");

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const response = await client.rooms.create.post({ roomTTLSeconds });

      if (response.status === 200) {
        router.push(`/room/${response.data?.roomId}`);
      }
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="bg-green-900/50 border border-green-800 p-4 text-green-400 text-sm">
            The room was destroyed successfully.
          </div>
        )}

        {error == "room_not_found" && (
          <div className="bg-red-900/50 border border-red-800 p-4 text-red-400 text-sm">
            The room was not found.
          </div>
        )}

        {error == "room_full" && (
          <div className="bg-red-900/50 border border-red-800 p-4 text-red-400 text-sm">
            The room is already full.
          </div>
        )}
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
                min={MIN_ROOM_TTL_SECONDS}
                max={MAX_ROOM_TTL_SECONDS}
                step={60}
                className="w-full bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-400"
                value={roomTTLSeconds}
                onChange={(e) =>
                  setRoomTTLSeconds(
                    Number.parseInt(e.target.value) || DEFAULT_ROOM_TTL_SECONDS,
                  )
                }
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
