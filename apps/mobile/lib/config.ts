// In dev, set EXPO_PUBLIC_API_BASE_URL in apps/mobile/.env to your machine's
// LAN IP (e.g. http://192.168.100.66:3000) so a real phone can reach the
// admin server. The iOS simulator can use http://localhost:3001.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
