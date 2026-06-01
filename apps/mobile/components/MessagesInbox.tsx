import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/api";
import type {
  InboxItem,
  InboxResponse,
  InboxSearchResponse,
  InboxSearchResult,
} from "@/lib/types";

const PAGE_SIZE = 20;

export function MessagesInbox({
  onOpenVisita,
  isAdminSide,
}: {
  onOpenVisita: (visitaId: string, search?: string, messageId?: string) => void;
  isAdminSide: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.headerTitle}>
          Mensajes
        </Text>
      </View>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Buscar por cliente o mensaje"
          value={search}
          onChangeText={setSearch}
          elevation={0}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>
      {debouncedSearch ? (
        <SearchList
          query={debouncedSearch}
          isAdminSide={isAdminSide}
          onOpenVisita={onOpenVisita}
        />
      ) : (
        <InboxList
          isAdminSide={isAdminSide}
          onOpenVisita={onOpenVisita}
        />
      )}
    </View>
  );
}

function InboxList({
  isAdminSide,
  onOpenVisita,
}: {
  isAdminSide: boolean;
  onOpenVisita: (visitaId: string, search?: string, messageId?: string) => void;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(
    async (offset: number, showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const res = await apiRequest<InboxResponse>(
          "/api/mobile/messages/inbox",
          { query: { offset, limit: PAGE_SIZE } }
        );
        setItems((prev) =>
          offset === 0 ? res.items : [...prev, ...res.items]
        );
        setNextOffset(res.nextOffset);
      } catch {
        // ignore
      } finally {
        if (showSpinner) setRefreshing(false);
        setHasLoadedOnce(true);
        hasLoadedOnceRef.current = true;
      }
    },
    []
  );

  useEffect(() => {
    load(0);
    const interval = setInterval(() => load(0), 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.visitaId}
      contentContainerStyle={styles.listContent}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(0, true)}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={async () => {
        if (nextOffset === null || loadingMore) return;
        setLoadingMore(true);
        await load(nextOffset);
        setLoadingMore(false);
      }}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator />
          </View>
        ) : null
      }
      ListEmptyComponent={
        !hasLoadedOnce ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Sin mensajes
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              Cuando recibas o envíes mensajes, los verás aquí.
            </Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => (
        <InboxRow
          item={item}
          isAdminSide={isAdminSide}
          onPress={() => onOpenVisita(item.visitaId)}
        />
      )}
    />
  );
}

function SearchList({
  query,
  isAdminSide,
  onOpenVisita,
}: {
  query: string;
  isAdminSide: boolean;
  onOpenVisita: (visitaId: string, search?: string, messageId?: string) => void;
}) {
  const [items, setItems] = useState<InboxSearchResult[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async (q: string, offset: number) => {
    if (offset === 0) setLoading(true);
    try {
      const res = await apiRequest<InboxSearchResponse>(
        "/api/mobile/messages/search",
        { query: { q, offset, limit: PAGE_SIZE } }
      );
      if (queryRef.current !== q) return;
      setItems((prev) =>
        offset === 0 ? res.items : [...prev, ...res.items]
      );
      setNextOffset(res.nextOffset);
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

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.resultId}
      contentContainerStyle={styles.listContent}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      onEndReachedThreshold={0.4}
      onEndReached={async () => {
        if (nextOffset === null || loadingMore) return;
        setLoadingMore(true);
        await load(query, nextOffset);
        setLoadingMore(false);
      }}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator />
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Sin coincidencias
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              Prueba con otro nombre o palabra.
            </Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => (
        <SearchResultRow
          item={item}
          term={query}
          isAdminSide={isAdminSide}
          onPress={() =>
            onOpenVisita(item.visitaId, query, item.match.messageId)
          }
        />
      )}
    />
  );
}

function InboxRow({
  item,
  isAdminSide,
  onPress,
}: {
  item: InboxItem;
  isAdminSide: boolean;
  onPress: () => void;
}) {
  const title = isAdminSide ? item.clienteNombre : item.servicioNombre;
  const subtitleTop = isAdminSide ? item.servicioNombre : item.clienteNombre;
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(title[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowText}>
        <View style={styles.topLine}>
          <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          {last ? (
            <Text variant="bodySmall" style={styles.timeStamp}>
              {formatRelative(last.createdAt)}
            </Text>
          ) : null}
        </View>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {subtitleTop}
        </Text>
        <View style={styles.bottomLine}>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={[
              styles.preview,
              item.unreadCount > 0 ? styles.previewUnread : null,
            ]}
          >
            {preview}
          </Text>
          {item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function SearchResultRow({
  item,
  term,
  isAdminSide,
  onPress,
}: {
  item: InboxSearchResult;
  term: string;
  isAdminSide: boolean;
  onPress: () => void;
}) {
  const title = isAdminSide ? item.clienteNombre : item.servicioNombre;
  const initial = (title[0] ?? "?").toUpperCase();
  const isMessage = item.match.type === "message";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.rowText}>
        <View style={styles.topLine}>
          <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
            {isMessage ? (
              title
            ) : (
              <HighlightedText text={title} term={term} style={styles.rowTitle} />
            )}
          </Text>
          <Text variant="bodySmall" style={styles.timeStamp}>
            {formatRelative(item.match.createdAt)}
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {isAdminSide ? item.servicioNombre : item.clienteNombre}
        </Text>
        <View style={styles.bottomLine}>
          {isMessage ? (
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={styles.preview}
            >
              {item.match.mine ? "Tú: " : ""}
              <HighlightedText
                text={item.match.text}
                term={term}
                style={styles.preview}
              />
            </Text>
          ) : (
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              Coincidencia en el nombre del cliente
            </Text>
          )}
          {item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function HighlightedText({
  text,
  term,
  style,
}: {
  text: string;
  term: string;
  // Just used for type symmetry; rendering is plain Text.
  style?: object;
}) {
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
      {parts.map((p, j) =>
        p.match ? (
          <Text key={j} style={[style, { fontWeight: "700", color: "#111" }]}>
            {p.text}
          </Text>
        ) : (
          <React.Fragment key={j}>{p.text}</React.Fragment>
        )
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    color: "#111",
    fontWeight: "700",
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
  },
  searchInput: { fontSize: 15 },

  listContent: { padding: 16, paddingBottom: 32 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    gap: 12,
  },
  rowPressed: { backgroundColor: "#eaeaea" },
  rowText: { flex: 1, gap: 2 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { color: "#111", fontWeight: "500", flexShrink: 1 },
  muted: { color: "#888" },
  preview: { color: "#666", flexShrink: 1, flex: 1 },
  previewUnread: { color: "#111", fontWeight: "500" },
  timeStamp: { color: "#888", flexShrink: 0 },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f5e9",
  },
  avatarText: { color: "#2e7d32", fontWeight: "600", fontSize: 14 },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  sep: { height: 6 },

  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },

  empty: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888", textAlign: "center", paddingHorizontal: 24 },
});
