import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ElectionPage } from "./ElectionPage";

it("affiche l'id de l'élection", () => {
	render(<ElectionPage id="42" />);
	expect(
		screen.getByRole("heading", { name: "Élection 42" }),
	).toBeInTheDocument();
});
