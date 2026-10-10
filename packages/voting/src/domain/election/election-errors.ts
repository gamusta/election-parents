export type CreateElectionError = "period_already_started";

export type EditListsError =
	| "election_not_draft"
	| "duplicate_list"
	| "duplicate_list_name"
	| "invalid_list_name"
	| "list_not_found";

export type OpenElectionError =
	| "election_not_draft"
	| "no_candidate_lists"
	| "outside_voting_period";

export type CloseElectionError =
	| "election_not_open"
	| "voting_period_not_ended";
