import { Elysia, t } from "elysia";

const rooms = new Elysia({ prefix: "/rooms" }).post("/create", async ({ body }) => {
  return {
    message: "Room created",
    data: body,
  };
});

export const app = new Elysia({ prefix: "/api" })
  .use(rooms)
  .get("/", async () => {
    return {
      message: "API is working",
    };
  });

export const GET = app.fetch;
export const POST = app.fetch;
