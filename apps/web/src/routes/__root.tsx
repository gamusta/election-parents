import {
	createRootRoute,
	type ErrorComponentProps,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createRootRoute({
	component: RootLayout,
	errorComponent: RootError,
	notFoundComponent: NotFound,
});

function RootLayout() {
	return (
		<>
			<header>
				<nav>
					<Link to="/">Accueil</Link>
				</nav>
			</header>
			<main>
				<Outlet />
			</main>
		</>
	);
}

function RootError({ error, reset }: ErrorComponentProps) {
	useEffect(() => {
		// Dev console only; never shown to the user.
		console.error(error);
	}, [error]);

	return (
		<main role="alert">
			<h1>Une erreur est survenue.</h1>
			<button type="button" onClick={reset}>
				Réessayer
			</button>
			<Link to="/">Retour à l'accueil</Link>
		</main>
	);
}

function NotFound() {
	return (
		<main>
			<h1>Page introuvable.</h1>
			<Link to="/">Retour à l'accueil</Link>
		</main>
	);
}
