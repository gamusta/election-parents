import { z } from "zod";

export const ElectionIdSchema = z.uuid();
export type ElectionId = z.infer<typeof ElectionIdSchema>;
