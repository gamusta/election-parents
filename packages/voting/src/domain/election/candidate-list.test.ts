import { assert, describe, expect, it } from "vitest";
import { Candidate } from "./candidate";
import { CandidateList } from "./candidate-list";
import { CandidateListId } from "./candidate-list-id";

const listId = (raw: string) => {
	const id = CandidateListId.create(raw);
	assert(id.ok);
	return id.value;
};

const candidate = (name: string) => {
	const c = Candidate.create(name);
	assert(c.ok);
	return c.value;
};

const ID_A = listId("6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b");
const ID_B = listId("7a2d3c4b-5e6f-4a71-9b8c-0d1e2f3a4b5c");

const newList = (id = ID_A, name = "Parents engagés") => {
	const list = CandidateList.create({
		id,
		name,
		candidates: [candidate("Alice Martin"), candidate("Bruno Petit")],
	});
	assert(list.ok);
	return list.value;
};

describe("CandidateList", () => {
	it("rejects a blank name", () => {
		expect(
			CandidateList.create({
				id: ID_A,
				name: "   ",
				candidates: [candidate("A")],
			}),
		).toEqual({ ok: false, error: "invalid_list_name" });
	});

	it("rejects a list without candidates", () => {
		expect(
			CandidateList.create({ id: ID_A, name: "Liste", candidates: [] }),
		).toEqual({ ok: false, error: "no_candidates" });
	});

	it("normalises whitespace in the name", () => {
		expect(newList(ID_A, "  Parents   engagés ").name).toBe("Parents engagés");
	});

	it("keeps its identity when renamed", () => {
		const list = newList();
		const before = CandidateList.reconstitute({
			id: list.id,
			name: list.name,
			candidates: list.candidates,
		});
		assert(list.rename("Ensemble pour l'école").ok);
		expect(list.name).toBe("Ensemble pour l'école");
		expect(list.equals(before)).toBe(true);
	});

	it("is not equal to a list with the same attributes but another id", () => {
		expect(newList(ID_A).equals(newList(ID_B))).toBe(false);
	});

	it("contrasts with Candidate, a Value Object equal by value", () => {
		expect(candidate("Alice Martin").equals(candidate(" Alice  Martin"))).toBe(
			true,
		);
	});

	it("is protected from changes to the caller's array", () => {
		const candidates = [candidate("Alice Martin")];
		const list = CandidateList.create({ id: ID_A, name: "L", candidates });
		assert(list.ok);
		candidates.push(candidate("Intruder"));
		expect(list.value.candidates).toHaveLength(1);
		expect(Object.isFrozen(list.value.candidates)).toBe(true);
	});
});
