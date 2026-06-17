import { redis } from "@/lib/redis";
import { Elysia, t } from "elysia";

const rooms = new Elysia({ prefix: "/rooms" }).post(
  "/create",
  async ({ body }) => {
    const roomId = Math.random().toString(36).substring(2, 15);

    await redis.hset(`room:${roomId}`, {
      createdAt: Date.now(),
      participants: [],
    });

    await redis.expire(`room:${roomId}`, body.roomTTLSeconds);

    return {
      message: "Room created successfully",
      roomId,
    };
  },
  {
    body: t.Object({
      roomTTLSeconds: t.Number(),
    }),
  },
);

export const app = new Elysia({ prefix: "/api" })
  .use(rooms)
  .get("/", async () => {
    return {
      message: "API is working",
    };
  });

export const GET = app.fetch;
export const POST = app.fetch;
