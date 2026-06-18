import { redis } from "@/lib/redis";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./auth";
import { Message, realtime } from "@/lib/realtime";
import { nanoid } from "nanoid";
import {
  createRoomBodySchema,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_MESSAGES_PER_ROOM,
  MAX_ROOM_TTL_SECONDS,
  MAX_SENDER_LENGTH,
  messageBodySchema,
  MIN_ROOM_TTL_SECONDS,
  roomIdSchema,
} from "@/lib/schema";

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class RateLimitError extends Error {
  constructor(message = "Too many requests. Try again soon.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const getClientId = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwardedFor?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
};

const checkRateLimit = async ({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}) => {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);

  if (count > limit) {
    throw new RateLimitError();
  }
};

const rooms = new Elysia({ prefix: "/rooms" })
  .post(
    "/create",
    async ({ body, request }) => {
      const parsedBody = createRoomBodySchema.safeParse(body);
      if (!parsedBody.success) {
        throw new BadRequestError(
          `Room TTL must be an integer between ${MIN_ROOM_TTL_SECONDS} and ${MAX_ROOM_TTL_SECONDS} seconds.`,
        );
      }

      await checkRateLimit({
        key: `rate:rooms:create:${getClientId(request)}`,
        limit: 10,
        windowSeconds: 60,
      });

      const roomId = nanoid(16);

      await redis.hset(`room:${roomId}`, {
        createdAt: Date.now(),
        participants: [],
      });

      await redis.expire(`room:${roomId}`, parsedBody.data.roomTTLSeconds);

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
      const parsedRoomId = roomIdSchema.safeParse(auth.roomId);
      if (!parsedRoomId.success) throw new BadRequestError("Invalid room ID.");

      const ttl = await redis.ttl(`room:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: t.Object({ roomId: t.String() }) },
  )
  .delete(
    "/",
    async ({ auth }) => {
      const parsedRoomId = roomIdSchema.safeParse(auth.roomId);
      if (!parsedRoomId.success) throw new BadRequestError("Invalid room ID.");

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
      const parsedBody = messageBodySchema.safeParse(body);
      if (!parsedBody.success) {
        throw new BadRequestError("Message payload is invalid.");
      }

      const parsedRoomId = roomIdSchema.safeParse(auth.roomId);
      if (!parsedRoomId.success) throw new BadRequestError("Invalid room ID.");

      await checkRateLimit({
        key: `rate:messages:room:${auth.roomId}:token:${auth.token}`,
        limit: 12,
        windowSeconds: 10,
      });
      await checkRateLimit({
        key: `rate:messages:hour:${auth.roomId}:token:${auth.token}`,
        limit: 240,
        windowSeconds: 60 * 60,
      });

      const { sender, text } = parsedBody.data;
      const { roomId } = auth;

      const roomExists = await redis.exists(`room:${roomId}`);
      if (!roomExists) return { error: "Room does not exist" };

      const messageCount = await redis.llen(`messages:${roomId}`);
      if (messageCount >= MAX_MESSAGES_PER_ROOM) {
        throw new RateLimitError("This room has reached its message limit.");
      }

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
        sender: t.String({ minLength: 1, maxLength: MAX_SENDER_LENGTH }),
        text: t.String({ minLength: 1, maxLength: MAX_MESSAGE_TEXT_LENGTH }),
      }),
    },
  )
  .get(
    "/",
    async ({ auth }) => {
      const parsedRoomId = roomIdSchema.safeParse(auth.roomId);
      if (!parsedRoomId.success) throw new BadRequestError("Invalid room ID.");

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
  .error({ BadRequestError, RateLimitError })
  .onError(({ code, error, set }) => {
    if (code === "BadRequestError") {
      set.status = 400;
      return { error: error.message };
    }

    if (code === "RateLimitError") {
      set.status = 429;
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
