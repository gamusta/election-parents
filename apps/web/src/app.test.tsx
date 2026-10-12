import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "./App";

it("affiche le titre", () => {
	render(<App />);
	expect(
		screen.getByRole("heading", { name: "Get started" }),
	).toBeInTheDocument();
});
