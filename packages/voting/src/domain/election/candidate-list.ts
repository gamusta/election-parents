import { err, ok, type Result } from "@election/kernel";
import type { Candidate } from "./candidate";
import type { CandidateListId } from "./candidate-list-id";

export type CandidateListError = "invalid_list_name" | "no_candidates";

export interface CandidateListProps {
	readonly id: CandidateListId;
	readonly name: string;
	readonly candidates: readonly Candidate[];
}

const normalizeName = (raw: string): string => raw.trim().replace(/\s+/g, " ");

/**
 * Entity inside the Election aggregate: identity (id) is stable while its
 * name may change. Only Election calls the mutators, so that the
 * "no change after opening" rule is enforced in one place.
 */
export class CandidateList {
	private constructor(
		readonly id: CandidateListId,
		private currentName: string,
		private readonly currentCandidates: readonly Candidate[],
	) {}

	/** New list: validates, takes defensive copies. */
	static create(
		props: CandidateListProps,
	): Result<CandidateList, CandidateListError> {
		const name = normalizeName(props.name);
		if (name.length === 0) return err("invalid_list_name");
		if (props.candidates.length === 0) return err("no_candidates");
		return ok(
			new CandidateList(props.id, name, Object.freeze([...props.candidates])),
		);
	}

	/** Persisted list: trusted, no validation. */
	static reconstitute(props: CandidateListProps): CandidateList {
		return new CandidateList(
			props.id,
			props.name,
			Object.freeze([...props.candidates]),
		);
	}

	get name(): string {
		return this.currentName;
	}

	get candidates(): readonly Candidate[] {
		return this.currentCandidates;
	}

	rename(raw: string): Result<void, "invalid_list_name"> {
		const name = normalizeName(raw);
		if (name.length === 0) return err("invalid_list_name");
		this.currentName = name;
		return ok();
	}

	/** Entity equality: same id, whatever the attributes. */
	equals(other: CandidateList): boolean {
		return this.id.equals(other.id);
	}
}
