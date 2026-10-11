import { z } from "zod";

export const ElectionIdSchema = z.uuid();
export type ElectionId = z.infer<typeof ElectionIdSchema>;

export const ElectionResponseSchema = z.object({
	id: ElectionIdSchema,
	status: z.enum(["draft", "open", "closed"]),
	opensAt: z.iso.datetime(),
	closesAt: z.iso.datetime(),
	seats: z.number().int().positive(),
	lists: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type ElectionResponse = z.infer<typeof ElectionResponseSchema>;

// Client-generated, reused on retry: same key = same vote (ClientRequestToken).
export const IdempotencyKeySchema = z.uuid();

// The ballot carries the choice only: no voter id, no timestamp.
export const CastVoteRequestSchema = z.strictObject({ listId: z.uuid() });
export type CastVoteRequest = z.infer<typeof CastVoteRequestSchema>;

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

// Digits only, then 1–200000 PBKDF2 iterations of CPU work.
export const LabCpuWorkSchema = z
	.string()
	.regex(/^\d{1,6}$/)
	.transform(Number)
	.pipe(z.number().int().min(1).max(200_000));
export type LabCpuWork = z.infer<typeof LabCpuWorkSchema>;

// Lab 6: up to 40 s, past both the Lambda timeout and API Gateway's 29 s.
export const LabSleepMsSchema = z
	.string()
	.regex(/^\d{1,5}$/)
	.transform(Number)
	.pipe(z.number().int().min(0).max(40_000));
export type LabSleepMs = z.infer<typeof LabSleepMsSchema>;
