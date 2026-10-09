import { err, ok, type Result } from "@election/kernel";

export type SeatCountError = "invalid_seat_count";

export class SeatCount {
	private constructor(readonly value: number) {}

	static create(raw: number): Result<SeatCount, SeatCountError> {
		return Number.isSafeInteger(raw) && raw >= 1
			? ok(new SeatCount(raw))
			: err("invalid_seat_count");
	}

	equals(other: SeatCount): boolean {
		return this.value === other.value;
	}
}
