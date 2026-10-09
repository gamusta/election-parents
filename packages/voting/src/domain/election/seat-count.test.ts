import { assert, describe, expect, it } from "vitest";
import { SeatCount } from "./seat-count";

describe("SeatCount", () => {
	it("accepts a positive integer", () => {
		const seats = SeatCount.create(5);
		assert(seats.ok);
		expect(seats.value.value).toBe(5);
	});

	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects %s",
		(raw) => {
			expect(SeatCount.create(raw)).toEqual({
				ok: false,
				error: "invalid_seat_count",
			});
		},
	);

	it("is equal by value", () => {
		const a = SeatCount.create(3);
		const b = SeatCount.create(3);
		assert(a.ok && b.ok);
		expect(a.value.equals(b.value)).toBe(true);
	});
});
