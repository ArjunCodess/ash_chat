import { redis } from "@/lib/redis";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./auth";

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

const messages = new Elysia({ prefix: "/messages" }).use(authMiddleware).post(
  "/",
  async ({ body, auth, query }) => {
    const { sender, text } = body;
    const { roomId } = auth;
    
    const roomExists = await redis.exists(`room:${roomId}`);
    if (!roomExists) return { error: "Room does not exist" };
  },
  {
    query: t.Object({
      roomId: t.String(),
    }),
    body: t.Object({
      sender: t.String({ maxLength: 100 }),
      text: t.String({ maxLength: 500 }),
    }),
  },
);

export const app = new Elysia({ prefix: "/api" })
  .use(rooms)
  .use(messages)
  .get("/", async () => {
    return {
      message: "API is working",
    };
  });

export const GET = app.fetch;
export const POST = app.fetch;
