import { z } from "zod";

export const ElectionIdSchema = z.uuid();
export type ElectionId = z.infer<typeof ElectionIdSchema>;

// Query strings are text: digits only (rejects "", " ", "1e3", "0x10", "1.5", "-1").
export const SleepMsSchema = z
	.string()
	.regex(/^\d{1,4}$/)
	.transform(Number)
	.pipe(z.number().int().min(0).max(5000));
export type SleepMs = z.infer<typeof SleepMsSchema>;

// Lab-only query params (health handler, LAB_MODE=1).
export const LabTagSchema = z.string().regex(/^[A-Za-z0-9]{1,20}$/);
export type LabTag = z.infer<typeof LabTagSchema>;

export const LabBgSchema = z.literal("1");
export type LabBg = z.infer<typeof LabBgSchema>;
