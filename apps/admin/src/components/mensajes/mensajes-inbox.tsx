"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { statusMeta, type EstadoVisitaUI } from "@/components/ui/status-badge";

interface InboxItem {
  visitaId: string;
  fechaProgramada: string;
  estado: string;
  servicioNombre: string;
  clienteNombre: string;
  lastMessage: {
    id: string;
    body: string | null;
    hasMedia: boolean;
    createdAt: string;
    authorUserId: string;
    authorName: string;
    mine: boolean;
  } | null;
  unreadCount: number;
}

interface InboxResponse {
  items: InboxItem[];
  nextOffset: number | null;
}

interface SearchResult {
  resultId: string;
  visitaId: string;
  servicioNombre: string;
  clienteNombre: string;
  fechaProgramada: string;
  estado: string;
  unreadCount: number;
  match: {
    type: "name" | "message";
    text: string;
    createdAt: string;
    messageId?: string;
    authorName?: string;
    mine?: boolean;
  };
}

interface SearchResponse {
  items: SearchResult[];
  nextOffset: number | null;
}

const PAGE_SIZE = 20;

export function MensajesInbox() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o por texto del mensaje"
          className="pl-9"
        />
      </div>

      {debouncedSearch ? (
        <SearchList query={debouncedSearch} />
      ) : (
        <InboxList />
      )}
    </div>
  );
}

function InboxList() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset: number) => {
    try {
      const res = await fetch(
        `/api/admin/messages/inbox?offset=${offset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("load failed");
      const data: InboxResponse = await res.json();
      setItems((prev) =>
        offset === 0 ? data.items : [...prev, ...data.items]
      );
      setNextOffset(data.nextOffset);
    } catch {
      // ignore
    } finally {
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    load(0);
    const interval = setInterval(() => load(0), 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (!hasLoadedOnce) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <h3 className="text-base font-medium">Sin mensajes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando los clientes te escriban, las conversaciones aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {items.map((item) => (
          <InboxRow key={item.visitaId} item={item} />
        ))}
      </div>
      {nextOffset !== null ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(nextOffset);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SearchList({ query }: { query: string }) {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async (q: string, offset: number) => {
    if (offset === 0) setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/messages/search?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("search failed");
      const data: SearchResponse = await res.json();
      // Discard if the query has changed since we kicked off this request.
      if (queryRef.current !== q) return;
      setItems((prev) =>
        offset === 0 ? data.items : [...prev, ...data.items]
      );
      setNextOffset(data.nextOffset);
    } catch {
      // ignore
    } finally {
      if (offset === 0) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setNextOffset(null);
    load(query, 0);
  }, [query, load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Buscando…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <h3 className="text-base font-medium">Sin coincidencias</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Prueba con otro nombre o palabra.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {items.map((item) => (
          <SearchResultRow key={item.resultId} item={item} term={query} />
        ))}
      </div>
      {nextOffset !== null ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(query, nextOffset);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? "Cargando…" : "Cargar más resultados"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const last = item.lastMessage;
  let preview = "—";
  if (last) {
    const text =
      last.body && last.body.trim().length > 0
        ? last.body
        : last.hasMedia
          ? "📷 Adjunto"
          : "";
    preview = last.mine ? `Tú: ${text}` : text;
  }
  const dot = statusMeta[item.estado as EstadoVisitaUI]?.dot ?? "bg-muted-foreground";
  const unread = item.unreadCount > 0;

  return (
    <Link
      href={`/dashboard/mensajes/${item.visitaId}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60"
    >
      <div className="relative flex-none">
        <InitialsAvatar name={item.clienteNombre} size={42} />
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-[2.5px] ring-card ${dot}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-sm text-foreground ${
              unread ? "font-extrabold" : "font-bold"
            }`}
          >
            {item.clienteNombre}
          </p>
          {last ? (
            <span
              className={`flex-none text-[11.5px] font-semibold ${
                unread ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {formatRelative(last.createdAt)}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs font-bold text-green-700">
          {item.servicioNombre}
        </p>
        <div className="flex items-center gap-2">
          <p
            className={`mt-0.5 flex-1 truncate text-[13px] ${
              unread
                ? "font-semibold text-foreground"
                : "font-medium text-muted-foreground"
            }`}
          >
            {preview}
          </p>
          {unread ? (
            <span className="inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-primary px-1.5 text-[10.5px] font-extrabold text-primary-foreground">
              {item.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function SearchResultRow({
  item,
  term,
}: {
  item: SearchResult;
  term: string;
}) {
  const dot = statusMeta[item.estado as EstadoVisitaUI]?.dot ?? "bg-muted-foreground";
  const isMessage = item.match.type === "message";
  const href = isMessage
    ? `/dashboard/mensajes/${item.visitaId}?search=${encodeURIComponent(term)}&messageId=${item.match.messageId}`
    : `/dashboard/mensajes/${item.visitaId}?search=${encodeURIComponent(term)}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60"
    >
      <div className="relative flex-none">
        <InitialsAvatar name={item.clienteNombre} size={42} />
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-[2.5px] ring-card ${dot}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">
            {isMessage ? (
              item.clienteNombre
            ) : (
              <Highlighted text={item.clienteNombre} term={term} />
            )}
          </p>
          <span className="flex-none text-[11.5px] font-semibold text-muted-foreground">
            {formatRelative(item.match.createdAt)}
          </span>
        </div>
        <p className="truncate text-xs font-bold text-green-700">
          {item.servicioNombre}
        </p>
        <div className="flex items-center gap-2">
          {isMessage ? (
            <p className="mt-0.5 flex-1 truncate text-[13px] font-medium text-foreground">
              {item.match.mine ? "Tú: " : ""}
              <Highlighted text={item.match.text} term={term} />
            </p>
          ) : (
            <p className="mt-0.5 flex-1 truncate text-[13px] font-medium text-muted-foreground">
              Coincidencia en el nombre del cliente
            </p>
          )}
          {item.unreadCount > 0 ? (
            <span className="inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-primary px-1.5 text-[10.5px] font-extrabold text-primary-foreground">
              {item.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function Highlighted({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(lowerTerm, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({
      text: text.slice(idx, idx + term.length),
      match: true,
    });
    i = idx + term.length;
  }
  return (
    <>
      {parts.map((p, j) => (
        <Fragment key={j}>
          {p.match ? <strong className="font-semibold">{p.text}</strong> : p.text}
        </Fragment>
      ))}
    </>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Ayer";
  }
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}
