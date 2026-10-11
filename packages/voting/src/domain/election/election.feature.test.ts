import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import {
	AFTER,
	BEFORE,
	CLOSES,
	candidateList,
	DURING,
	draftElection,
	OPENS,
	unwrap,
} from "../../testing/fixtures";
import type { Election } from "./election";

// Resolved relative to this test file by vitest-cucumber.
const feature = await loadFeature("./election.feature");

// Scenario dates, mapped to the shared fixtures to avoid drifting copies.
const at = {
	"2026-10-01 00:00": BEFORE,
	"2026-10-16 08:00": OPENS,
	"2026-10-16 10:00": DURING,
	"2026-10-16 12:00": new Date("2026-10-16T12:00:00Z"),
	"2026-10-17 12:00": CLOSES,
	"2026-10-18 00:00": AFTER,
	"2026-10-18 01:00": new Date("2026-10-18T01:00:00Z"),
	// satisfies keeps literal keys: at["2026-10-16 10:00"] is a Date, not Date | undefined.
} satisfies Record<string, Date>;

describeFeature(feature, ({ Background, Scenario }) => {
	let election: Election;
	let outcome: { ok: boolean; error: string | undefined };

	const run = (result: { ok: boolean; error?: unknown }) => {
		outcome = {
			ok: result.ok,
			error: result.ok ? undefined : String(result.error),
		};
	};
	const addLists = (count: number) => {
		for (let n = 1; n <= count; n++) unwrap(election.addList(candidateList(n)));
	};

	Background(({ Given }) => {
		Given(
			"a draft election voting from 2026-10-16 08:00 to 2026-10-17 12:00",
			() => {
				election = draftElection();
			},
		);
	});

	Scenario(
		"Opening a draft election with lists during its period",
		({ Given, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			When("the organiser opens it on 2026-10-16 10:00", () =>
				run(election.open(at["2026-10-16 10:00"])),
			);
			Then("the election is open", () => {
				expect(outcome.ok).toBe(true);
				expect(election.status).toBe("open");
			});
		},
	);

	Scenario(
		"An election without candidate lists cannot be opened",
		({ When, Then, And }) => {
			When("the organiser opens it on 2026-10-16 10:00", () =>
				run(election.open(at["2026-10-16 10:00"])),
			);
			Then('it is refused with "no_candidate_lists"', () =>
				expect(outcome.error).toBe("no_candidate_lists"),
			);
			And("the election is still a draft", () =>
				expect(election.status).toBe("draft"),
			);
		},
	);

	Scenario(
		"An election cannot be opened before its period",
		({ Given, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			When("the organiser opens it on 2026-10-01 00:00", () =>
				run(election.open(at["2026-10-01 00:00"])),
			);
			Then('it is refused with "outside_voting_period"', () =>
				expect(outcome.error).toBe("outside_voting_period"),
			);
		},
	);

	Scenario(
		"Candidate lists are frozen once the election is open",
		({ Given, And, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			// Past-tense steps are setup: unwrap so a broken setup fails loudly.
			And("the organiser opened it on 2026-10-16 10:00", () =>
				unwrap(election.open(at["2026-10-16 10:00"])),
			);
			When("the organiser adds a candidate list", () =>
				run(election.addList(candidateList(3))),
			);
			Then('it is refused with "election_not_draft"', () => {
				expect(outcome.error).toBe("election_not_draft");
				expect(election.lists).toHaveLength(2);
			});
		},
	);

	Scenario(
		"Closing an election after its period",
		({ Given, And, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			And("the organiser opened it on 2026-10-16 10:00", () =>
				unwrap(election.open(at["2026-10-16 10:00"])),
			);
			When("the organiser closes it on 2026-10-18 00:00", () =>
				run(election.close(at["2026-10-18 00:00"])),
			);
			Then("the election is closed", () => {
				expect(outcome.ok).toBe(true);
				expect(election.status).toBe("closed");
			});
		},
	);

	Scenario(
		"An election cannot be closed before its period ends",
		({ Given, And, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			And("the organiser opened it on 2026-10-16 10:00", () =>
				unwrap(election.open(at["2026-10-16 10:00"])),
			);
			When("the organiser closes it on 2026-10-16 12:00", () =>
				run(election.close(at["2026-10-16 12:00"])),
			);
			Then('it is refused with "voting_period_not_ended"', () => {
				expect(outcome.error).toBe("voting_period_not_ended");
				expect(election.status).toBe("open");
			});
		},
	);

	Scenario(
		"A closed election is never reopened",
		({ Given, And, When, Then }) => {
			Given("the election has 2 candidate lists", () => addLists(2));
			And("the organiser opened it on 2026-10-16 10:00", () =>
				unwrap(election.open(at["2026-10-16 10:00"])),
			);
			And("the organiser closed it on 2026-10-18 00:00", () =>
				unwrap(election.close(at["2026-10-18 00:00"])),
			);
			When("the organiser opens it on 2026-10-18 01:00", () =>
				run(election.open(at["2026-10-18 01:00"])),
			);
			Then('it is refused with "election_not_draft"', () => {
				expect(outcome.error).toBe("election_not_draft");
				expect(election.status).toBe("closed");
			});
		},
	);
});
