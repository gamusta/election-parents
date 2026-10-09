import { assert, describe, expect, it } from "vitest";
import { ElectionPeriod } from "./election-period";

const OPENS = new Date("2026-10-16T08:00:00Z");
const CLOSES = new Date("2026-10-17T12:00:00Z");

const period = () => {
	const result = ElectionPeriod.create(OPENS, CLOSES);
	assert(result.ok);
	return result.value;
};

describe("ElectionPeriod", () => {
	it("rejects a period that does not move forward in time", () => {
		expect(ElectionPeriod.create(CLOSES, OPENS)).toEqual({
			ok: false,
			error: "period_not_chronological",
		});
		expect(ElectionPeriod.create(OPENS, OPENS)).toEqual({
			ok: false,
			error: "period_not_chronological",
		});
	});

	it("rejects an invalid date", () => {
		expect(ElectionPeriod.create(new Date("nope"), CLOSES)).toEqual({
			ok: false,
			error: "invalid_date",
		});
	});

	it("is open at opensAt and closed at closesAt (half-open interval)", () => {
		const p = period();
		expect(p.isOpenAt(new Date(OPENS.getTime() - 1))).toBe(false);
		expect(p.isOpenAt(OPENS)).toBe(true);
		expect(p.isOpenAt(new Date(CLOSES.getTime() - 1))).toBe(true);
		expect(p.isOpenAt(CLOSES)).toBe(false);
		expect(p.hasEndedAt(CLOSES)).toBe(true);
	});

	it("cannot be mutated through its dates", () => {
		const p = period();
		p.opensAt.setFullYear(2000);
		expect(p.opensAt).toEqual(OPENS);
	});

	it("is not affected by later mutation of the input dates", () => {
		const opens = new Date(OPENS);
		const result = ElectionPeriod.create(opens, CLOSES);
		assert(result.ok);
		opens.setFullYear(2000);
		expect(result.value.opensAt).toEqual(OPENS);
	});

	it("is equal by value", () => {
		expect(period().equals(period())).toBe(true);
	});
});
