import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

vi.mock("../../api/elections", () => ({
	getElection: vi.fn(async () => null),
}));

it("affiche « introuvable » quand l'API répond 404", async () => {
	renderAt("/elections/42");
	expect(await screen.findByText("Élection introuvable.")).toBeInTheDocument();
});
