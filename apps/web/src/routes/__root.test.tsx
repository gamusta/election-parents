import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderAt } from "../test/render";

vi.mock("../api/elections", () => ({
	getElection: vi.fn(async () => ({})),
}));

vi.mock("../features/elections/ElectionPage", () => ({
	ElectionPage: () => {
		throw new Error("secret internal detail");
	},
}));

beforeEach(() => {
	// React and RootError log the thrown error; keep test output clean.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

it("shows a generic message when a component throws, never the error details", async () => {
	renderAt("/elections/42");

	expect(
		await screen.findByRole("heading", { name: "Une erreur est survenue." }),
	).toBeInTheDocument();
	expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
});

it("shows the not-found page for an unknown URL", async () => {
	renderAt("/does-not-exist");

	expect(
		await screen.findByRole("heading", { name: "Page introuvable." }),
	).toBeInTheDocument();
});
