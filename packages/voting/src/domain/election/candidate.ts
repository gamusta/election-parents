import { err, ok, type Result } from "@election/kernel";

export type CandidateError = "invalid_candidate_name";

/**
 * A person on a list, as printed on the ballot. Value Object: two candidates
 * with the same name on the same list are indistinguishable for the vote.
 * Birth date (tie-break) belongs to School Management, not here.
 */
export class Candidate {
	private constructor(readonly name: string) {}

	static create(raw: string): Result<Candidate, CandidateError> {
		const name = raw.trim().replace(/\s+/g, " ");
		return name.length > 0
			? ok(new Candidate(name))
			: err("invalid_candidate_name");
	}

	equals(other: Candidate): boolean {
		return this.name === other.name;
	}
}
