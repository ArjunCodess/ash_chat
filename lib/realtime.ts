import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "@/lib/redis";
import { realtimeSchema } from "@/lib/schema";
import type { Message } from "@/lib/schema";

export const realtime = new Realtime({ schema: realtimeSchema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type { Message };
