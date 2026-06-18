import { NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { nanoid } from "nanoid";
import { MAX_ROOM_PARTICIPANTS, roomIdSchema } from "./lib/schema";

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname;

  const roomMatch = pathname.match(/^\/room\/([^\/]+)\/?$/);
  if (!roomMatch) return NextResponse.redirect(new URL("/", req.url));

  const roomId = roomMatch[1];
  if (!roomIdSchema.safeParse(roomId).success) {
    return NextResponse.redirect(new URL("/?error=room_not_found", req.url));
  }

  const room = await redis.hgetall<{ participants: string[]; createdAt: Date }>(
    `room:${roomId}`,
  );
  if (!room) return NextResponse.redirect(new URL("/?error=room_not_found", req.url));

  const existingToken = req.cookies.get("x-auth-token")?.value;
  if (existingToken && room.participants.includes(existingToken)) {
    return NextResponse.next();
  }
  
  if (room.participants.length >= MAX_ROOM_PARTICIPANTS) {
    return NextResponse.redirect(new URL("/?error=room_full", req.url));
  }

  const response = NextResponse.next();
  const token = nanoid(48);
  response.cookies.set("x-auth-token", token, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });

  await redis.hset(`room:${roomId}`, {
    participants: [...room.participants, token],
  });

  return response;
};

export const config = {
  matcher: "/room/:path*",
};
