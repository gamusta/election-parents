import { err, ok, type Result } from "@election/kernel";

// Canonical UUID, any version, lowercase.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ElectionIdError = "invalid_election_id";

export class ElectionId {
	private constructor(readonly value: string) {}

	static create(raw: string): Result<ElectionId, ElectionIdError> {
		const value = raw.toLowerCase();
		return UUID.test(value)
			? ok(new ElectionId(value))
			: err("invalid_election_id");
	}

	equals(other: ElectionId): boolean {
		return this.value === other.value;
	}

	toString(): string {
		return this.value;
	}
}
