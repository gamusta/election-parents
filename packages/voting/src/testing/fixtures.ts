import type { Result } from "@election/kernel";
import { Candidate } from "../domain/election/candidate";
import { CandidateList } from "../domain/election/candidate-list";
import { CandidateListId } from "../domain/election/candidate-list-id";
import { Election } from "../domain/election/election";
import { ElectionId } from "../domain/election/election-id";
import { ElectionPeriod } from "../domain/election/election-period";
import { SeatCount } from "../domain/election/seat-count";

/** Test-only: fails loudly instead of narrowing. */
export const unwrap = <T, E>(result: Result<T, E>): T => {
	if (!result.ok) throw new Error(`Expected ok, got ${String(result.error)}`);
	return result.value;
};

// Deterministic, valid UUIDs: uuid(1) → 00000000-0000-4000-8000-000000000001.
export const uuid = (n: number): string =>
	`00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const OPENS = new Date("2026-10-16T08:00:00Z");
export const CLOSES = new Date("2026-10-17T12:00:00Z");
export const BEFORE = new Date("2026-10-01T00:00:00Z");
export const DURING = new Date("2026-10-16T10:00:00Z");
export const AFTER = new Date("2026-10-18T00:00:00Z");

export const electionId = (n = 1) => unwrap(ElectionId.create(uuid(n)));
export const listId = (n: number) => unwrap(CandidateListId.create(uuid(n)));

export const candidateList = (n: number, name = `Liste ${n}`, size = 2) =>
	unwrap(
		CandidateList.create({
			id: listId(n),
			name,
			candidates: Array.from({ length: size }, (_, i) =>
				unwrap(Candidate.create(`Candidat ${n}.${i + 1}`)),
			),
		}),
	);

export const draftElection = (seats = 5) =>
	unwrap(
		Election.create(
			{
				id: electionId(),
				period: unwrap(ElectionPeriod.create(OPENS, CLOSES)),
				seats: unwrap(SeatCount.create(seats)),
			},
			BEFORE,
		),
	);

export const openElection = (listCount = 2, seats = 5) => {
	const election = draftElection(seats);
	for (let n = 1; n <= listCount; n++)
		unwrap(election.addList(candidateList(100 + n)));
	unwrap(election.open(DURING));
	return election;
};
