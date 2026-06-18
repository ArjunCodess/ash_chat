import { redis } from "@/lib/redis";
import { roomIdSchema } from "@/lib/schema";
import Elysia from "elysia";

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const authMiddleware = new Elysia({ name: "auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId as string;
    const token = cookie["x-auth-token"].value as string;

    if (!roomId || !token) {
      throw new AuthError("Missing roomId or token");
    }

    if (!roomIdSchema.safeParse(roomId).success) {
      throw new AuthError("Invalid roomId");
    }

    const participants = await redis.hget<string[]>(
      `room:${roomId}`,
      "participants",
    );

    if (!participants?.includes(token)) {
      throw new AuthError("Invalid token");
    }

    return { auth: { roomId, token, participants } };
  });
