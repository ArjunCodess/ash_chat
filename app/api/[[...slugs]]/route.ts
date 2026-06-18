import { redis } from "@/lib/redis";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./auth";
import { Message, realtime } from "@/lib/realtime";

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

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId } = auth;

      const roomExists = await redis.exists(`room:${roomId}`);
      if (!roomExists) return { error: "Room does not exist" };

      const message: Message = {
        id: Math.random().toString(36).substring(2, 15),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token: auth.token,
      });
      await realtime.channel(roomId).emit("chat.message", message);

      const remaining = await redis.ttl(`room:${roomId}`);

      await redis.expire(`messages:${roomId}`, remaining);
      await redis.expire(`history:${roomId}`, remaining);
      await redis.expire(roomId, remaining);

      return { message: "Message sent successfully" };
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
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(
        `messages:${auth.roomId}`,
        0,
        -1,
      );

      return {
        messages: messages.map((msg) => ({
          ...msg,
          token: msg.token === auth.token ? msg.token : undefined,
        })),
      };
    },
    {
      query: t.Object({
        roomId: t.String(),
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
