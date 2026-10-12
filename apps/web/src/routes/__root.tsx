import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootLayout });

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
