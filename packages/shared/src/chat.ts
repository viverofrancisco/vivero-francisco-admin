import { z } from "zod";

const chatMediaItemSchema = z.object({
  key: z.string().min(1),
  tipo: z.enum(["imagen", "video"]),
});

export const sendChatMessageSchema = z
  .object({
    body: z.string().max(2000).optional().nullable(),
    media: z.array(chatMediaItemSchema).optional(),
  })
  .refine(
    (v) =>
      (v.body && v.body.trim().length > 0) || (v.media && v.media.length > 0),
    { message: "El mensaje no puede estar vacío." }
  );
export type SendChatMessageBody = z.infer<typeof sendChatMessageSchema>;

export const chatListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type ChatListQuery = z.infer<typeof chatListQuerySchema>;

export const chatUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.string().min(1),
      })
    )
    .min(1)
    .max(10),
});
export type ChatUploadUrlsBody = z.infer<typeof chatUploadUrlsSchema>;
