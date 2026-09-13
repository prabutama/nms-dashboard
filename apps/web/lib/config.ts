const defaultApiBaseUrl = "";

export function getApiBaseUrl() {
	return process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiBaseUrl;
}
