import { err, ok, type Result } from "@election/kernel";

export type ElectionPeriodError = "invalid_date" | "period_not_chronological";

/**
 * Half-open interval [opensAt, closesAt): voting is allowed at opensAt,
 * refused at closesAt. Stored as epoch ms because Date is mutable.
 */
export class ElectionPeriod {
	private constructor(
		private readonly opensAtMs: number,
		private readonly closesAtMs: number,
	) {}

	static create(
		opensAt: Date,
		closesAt: Date,
	): Result<ElectionPeriod, ElectionPeriodError> {
		const opensAtMs = opensAt.getTime();
		const closesAtMs = closesAt.getTime();
		if (Number.isNaN(opensAtMs) || Number.isNaN(closesAtMs))
			return err("invalid_date");
		if (opensAtMs >= closesAtMs) return err("period_not_chronological");
		return ok(new ElectionPeriod(opensAtMs, closesAtMs));
	}

	get opensAt(): Date {
		return new Date(this.opensAtMs);
	}

	get closesAt(): Date {
		return new Date(this.closesAtMs);
	}

	isOpenAt(now: Date): boolean {
		const t = now.getTime();
		return t >= this.opensAtMs && t < this.closesAtMs;
	}

	hasEndedAt(now: Date): boolean {
		return now.getTime() >= this.closesAtMs;
	}

	equals(other: ElectionPeriod): boolean {
		return (
			this.opensAtMs === other.opensAtMs && this.closesAtMs === other.closesAtMs
		);
	}
}
