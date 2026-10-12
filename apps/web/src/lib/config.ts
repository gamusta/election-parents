const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) throw new Error("VITE_API_URL is missing (see .env.example)");

export const config = {
	apiUrl: apiUrl.replace(/\/$/, ""),
} as const;
