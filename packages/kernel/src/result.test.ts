import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./result";

const half = (n: number): Result<number, "odd_number"> =>
	n % 2 === 0 ? ok(n / 2) : err("odd_number");

describe("Result", () => {
	it("carries the value on success", () => {
		expect(half(4)).toEqual({ ok: true, value: 2 });
	});

	it("carries a literal error code on failure", () => {
		expect(half(3)).toEqual({ ok: false, error: "odd_number" });
	});

	it("narrows on the ok discriminant", () => {
		const result = half(4);
		// Without the check, `result.value` does not compile.
		expect(result.ok ? result.value : null).toBe(2);
	});
});
