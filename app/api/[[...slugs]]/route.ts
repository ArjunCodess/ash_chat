import { redis } from "@/lib/redis";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./auth";
import { Message, realtime } from "@/lib/realtime";
import { nanoid } from "nanoid";

const MIN_ROOM_TTL_SECONDS = 60;
const MAX_ROOM_TTL_SECONDS = 24 * 60 * 60;

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

const validateRoomTTL = (roomTTLSeconds: number) => {
  if (
    !Number.isInteger(roomTTLSeconds) ||
    roomTTLSeconds < MIN_ROOM_TTL_SECONDS ||
    roomTTLSeconds > MAX_ROOM_TTL_SECONDS
  ) {
    throw new BadRequestError(
      `Room TTL must be an integer between ${MIN_ROOM_TTL_SECONDS} and ${MAX_ROOM_TTL_SECONDS} seconds.`,
    );
  }
};

const rooms = new Elysia({ prefix: "/rooms" })
  .post(
    "/create",
    async ({ body }) => {
      validateRoomTTL(body.roomTTLSeconds);

      const roomId = nanoid(16);

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
        roomTTLSeconds: t.Number({
          minimum: MIN_ROOM_TTL_SECONDS,
          maximum: MAX_ROOM_TTL_SECONDS,
        }),
      }),
    },
  )
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`room:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: t.Object({ roomId: t.String() }) },
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.destroy", { isDestroyed: true });

      await Promise.all([
        redis.del(auth.roomId),
        redis.del(`room:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
      ]);
    },
    { query: t.Object({ roomId: t.String() }) },
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
        id: nanoid(16),
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
  .error({ BadRequestError })
  .onError(({ code, error, set }) => {
    if (code === "BadRequestError") {
      set.status = 400;
      return { error: error.message };
    }
  })
  .use(rooms)
  .use(messages)
  .get("/", async () => {
    return {
      message: "API is working",
    };
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
