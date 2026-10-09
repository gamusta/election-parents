import { assert, describe, expect, it } from "vitest";
import { ElectionId } from "./election-id";

const RAW = "0b7e4c2a-9f1d-4e3b-8a6c-5d2f1e0a9b8c";

describe("ElectionId", () => {
	it("accepts a UUID and normalises it to lowercase", () => {
		const id = ElectionId.create(RAW.toUpperCase());
		assert(id.ok);
		expect(id.value.value).toBe(RAW);
	});

	it.each(["", "not-a-uuid", `${RAW}0`, ` ${RAW}`])("rejects %j", (raw) => {
		expect(ElectionId.create(raw)).toEqual({
			ok: false,
			error: "invalid_election_id",
		});
	});

	it("is equal by value, not by reference", () => {
		const a = ElectionId.create(RAW);
		const b = ElectionId.create(RAW.toUpperCase());
		assert(a.ok && b.ok);
		expect(a.value).not.toBe(b.value);
		expect(a.value.equals(b.value)).toBe(true);
	});
});
