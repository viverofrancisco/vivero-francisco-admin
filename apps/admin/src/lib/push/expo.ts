import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_REGEX = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function isValidExpoToken(token: string): boolean {
  return EXPO_TOKEN_REGEX.test(token);
}

function authHeaders(): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  const key = process.env.EXPO_ACCESS_TOKEN;
  if (key) base.Authorization = `Bearer ${key}`;
  return base;
}

async function sendBatch(
  tokens: string[],
  payload: PushPayload
): Promise<Array<{ token: string; ticket: ExpoTicket }>> {
  if (tokens.length === 0) return [];

  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      return tokens.map((token) => ({
        token,
        ticket: { status: "error", message: `HTTP ${res.status}` },
      }));
    }

    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    return tokens.map((token, i) => ({
      token,
      ticket: tickets[i] ?? { status: "error", message: "no ticket" },
    }));
  } catch (err) {
    return tokens.map((token) => ({
      token,
      ticket: {
        status: "error",
        message: err instanceof Error ? err.message : "unknown",
      },
    }));
  }
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) return;

  const all = tokens.map((t) => t.token);
  const results = await sendBatch(all, payload);

  const toDelete: string[] = [];
  const toTouch: string[] = [];
  for (const { token, ticket } of results) {
    if (ticket.status === "ok") {
      toTouch.push(token);
      continue;
    }
    const err = ticket.details?.error;
    if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
      toDelete.push(token);
    }
  }

  if (toDelete.length > 0) {
    await prisma.pushToken.deleteMany({
      where: { token: { in: toDelete } },
    });
  }
  if (toTouch.length > 0) {
    await prisma.pushToken.updateMany({
      where: { token: { in: toTouch } },
      data: { lastUsedAt: new Date() },
    });
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  await sendPushToUsers([userId], payload);
}
