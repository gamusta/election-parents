import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomePage } from "./HomePage";

it("affiche le titre", () => {
	render(<HomePage />);
	expect(
		screen.getByRole("heading", { name: "Élections" }),
	).toBeInTheDocument();
});
