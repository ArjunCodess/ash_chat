import z from "zod/v4";

export const ROOM_ID_LENGTH = 16;
export const PARTICIPANT_TOKEN_LENGTH = 48;
export const MIN_ROOM_TTL_SECONDS = 60;
export const MAX_ROOM_TTL_SECONDS = 24 * 60 * 60;
export const MAX_ROOM_PARTICIPANTS = 2;
export const MAX_MESSAGES_PER_ROOM = 500;
export const MAX_SENDER_LENGTH = 100;
export const MAX_MESSAGE_TEXT_LENGTH = 500;
export const MAX_CIPHERTEXT_LENGTH = 2048;
export const MAX_IV_LENGTH = 64;

export const roomIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16}$/, "Invalid room ID.");

export const createRoomBodySchema = z.object({
  roomTTLSeconds: z
    .number()
    .int()
    .min(MIN_ROOM_TTL_SECONDS)
    .max(MAX_ROOM_TTL_SECONDS),
});

export const messageBodySchema = z.object({
  sender: z.string().trim().min(1).max(MAX_SENDER_LENGTH),
  ciphertext: z.string().min(1).max(MAX_CIPHERTEXT_LENGTH),
  iv: z.string().min(1).max(MAX_IV_LENGTH),
});

export const messageSchema = z.object({
  id: z.string().max(100),
  sender: z.string().max(MAX_SENDER_LENGTH),
  ciphertext: z.string().max(MAX_CIPHERTEXT_LENGTH),
  iv: z.string().max(MAX_IV_LENGTH),
  timestamp: z.number(),
  roomId: roomIdSchema,
  token: z.string().max(100).optional(),
});

export const realtimeSchema = {
  chat: {
    message: messageSchema,
    destroy: z.object({
      isDestroyed: z.literal(true),
    }),
  },
};

export type Message = z.infer<typeof messageSchema>;
