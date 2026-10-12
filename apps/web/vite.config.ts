/// <reference types="vitest/config" />
import tanstackRouter from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			routeFileIgnorePattern: "\\.test\\.tsx?$",
		}),
		react(),
	],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
	},
});
