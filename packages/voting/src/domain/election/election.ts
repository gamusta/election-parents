import { err, ok, type Result } from "@election/kernel";
import { type CandidateList, normalizeListName } from "./candidate-list";
import type { CandidateListId } from "./candidate-list-id";
import type {
	CloseElectionError,
	CreateElectionError,
	EditListsError,
	OpenElectionError,
} from "./election-errors";
import type { ElectionId } from "./election-id";
import type { ElectionPeriod } from "./election-period";
import type { SeatCount } from "./seat-count";

export type ElectionStatus = "draft" | "open" | "closed";

/** Read-only view of a list: mutators stay behind the aggregate root. */
export type CandidateListView = Omit<CandidateList, "rename">;

export interface ElectionProps {
	readonly id: ElectionId;
	readonly period: ElectionPeriod;
	readonly seats: SeatCount;
	readonly status: ElectionStatus;
	readonly lists: readonly CandidateList[];
}

// Two list names clash if they differ only by case or spacing.
const nameKey = (name: string): string =>
	normalizeListName(name).toLocaleLowerCase("fr");

/**
 * Aggregate root. Invariants:
 * - lists are only edited while draft;
 * - list ids and names are unique within the election;
 * - opening needs at least one list and happens inside the period;
 * - closing happens once the period has ended;
 * - status only moves draft → open → closed.
 */
export class Election {
	private constructor(
		readonly id: ElectionId,
		readonly period: ElectionPeriod,
		readonly seats: SeatCount,
		private currentStatus: ElectionStatus,
		private readonly currentLists: CandidateList[],
	) {}

	static create(
		props: {
			readonly id: ElectionId;
			readonly period: ElectionPeriod;
			readonly seats: SeatCount;
		},
		now: Date,
	): Result<Election, CreateElectionError> {
		const { id, period, seats } = props;
		if (period.isOpenAt(now) || period.hasEndedAt(now))
			return err("period_already_started");
		return ok(new Election(id, period, seats, "draft", []));
	}

	static reconstitute(props: ElectionProps): Election {
		const { id, period, seats, status, lists } = props;
		return new Election(id, period, seats, status, [...lists]);
	}

	get status(): ElectionStatus {
		return this.currentStatus;
	}

	get lists(): readonly CandidateListView[] {
		return Object.freeze([...this.currentLists]);
	}

	addList(list: CandidateList): Result<void, EditListsError> {
		if (this.currentStatus !== "draft") return err("election_not_draft");
		if (this.findList(list.id)) return err("duplicate_list");
		if (this.isNameTaken(list.name)) return err("duplicate_list_name");
		this.currentLists.push(list);
		return ok();
	}

	renameList(
		listId: CandidateListId,
		name: string,
	): Result<void, EditListsError> {
		if (this.currentStatus !== "draft") return err("election_not_draft");
		const list = this.findList(listId);
		if (!list) return err("list_not_found");
		if (this.isNameTaken(name, listId)) return err("duplicate_list_name");
		return list.rename(name);
	}

	removeList(listId: CandidateListId): Result<void, EditListsError> {
		if (this.currentStatus !== "draft") return err("election_not_draft");
		const index = this.currentLists.findIndex((l) => l.id.equals(listId));
		if (index === -1) return err("list_not_found");
		this.currentLists.splice(index, 1);
		return ok();
	}

	open(now: Date): Result<void, OpenElectionError> {
		if (this.currentStatus !== "draft") return err("election_not_draft");
		if (this.currentLists.length === 0) return err("no_candidate_lists");
		if (!this.period.isOpenAt(now)) return err("outside_voting_period");
		this.currentStatus = "open";
		return ok();
	}

	close(now: Date): Result<void, CloseElectionError> {
		if (this.currentStatus !== "open") return err("election_not_open");
		if (!this.period.hasEndedAt(now)) return err("voting_period_not_ended");
		this.currentStatus = "closed";
		return ok();
	}

	equals(other: Election): boolean {
		return this.id.equals(other.id);
	}

	private findList(listId: CandidateListId): CandidateList | undefined {
		return this.currentLists.find((l) => l.id.equals(listId));
	}

	private isNameTaken(name: string, except?: CandidateListId): boolean {
		const key = nameKey(name);
		return this.currentLists.some(
			(l) => nameKey(l.name) === key && !(except && l.id.equals(except)),
		);
	}
}
