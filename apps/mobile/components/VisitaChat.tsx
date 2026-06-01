import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator, IconButton, Text } from "react-native-paper";
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { apiRequest, ApiError } from "@/lib/api";
import type {
  ChatListResponse,
  ChatMediaItem,
  ChatMessage,
  VisitaDetail,
  VisitaMedia,
} from "@/lib/types";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";

interface PendingAttachment {
  id: string; // local id (also used as React key)
  uri: string;
  fileName: string;
  contentType: string;
  tipo: "imagen" | "video";
  thumbUri?: string;
}

interface ChatUploadDescriptor {
  key: string;
  uploadUrl: string;
  tipo: "imagen" | "video";
  contentType: string;
}

interface ChatUploadsResponse {
  uploads: ChatUploadDescriptor[];
}

export interface VisitaChatBanner {
  fechaProgramada: string; // ISO
  estado: string;
  servicioNombre: string;
  clienteNombre?: string;
}

export function VisitaChat({
  visitaId,
  title,
  subtitle,
  banner,
  visita,
  onBack,
  initialSearch,
  initialMessageId,
}: {
  visitaId: string;
  title: string;
  subtitle?: string;
  banner?: VisitaChatBanner;
  // Pass the full visita to enable an inline "details" sheet on banner tap.
  // Without it, the banner is read-only.
  visita?: VisitaDetail | null;
  onBack: () => void;
  // When the user opens the chat from a search result in the inbox, this is
  // the term they searched for. The chat highlights matching messages and
  // jumps to the latest match.
  initialSearch?: string;
  // When opening from a specific message-match result, jump to that exact
  // message instead of the latest match.
  initialMessageId?: string;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // Whether the user is near the bottom of the list. Defaults to true so the
  // initial load scrolls to the bottom; flips to false if they scroll up.
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    // Hide the bottom tab bar while the chat is open (focus on the
    // conversation, no accidental tab switches, and the composer can use
    // the real safe-area inset for the home indicator without the tab bar
    // adding extra space below it).
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(null);
  // Match navigation when arriving from a search result.
  const [searchTerm, setSearchTerm] = useState<string | null>(
    initialSearch ?? null
  );
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);
  // Tracks the last term we auto-jumped to. When the user changes the term
  // (typing), this differs and we re-jump. When polling adds messages
  // without the term changing, this stays equal and we don't yank scroll.
  const lastJumpedTermRef = useRef<string | null>(null);
  const initialMessageIdRef = useRef<string | undefined>(initialMessageId);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<ChatListResponse>(
        `/api/mobile/visitas/${visitaId}/messages`,
        { query: { limit: 200 } }
      );
      setMessages(res.items);
      setPeerLastReadAt(res.peerLastReadAt);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  }, [visitaId]);

  const markRead = useCallback(async () => {
    try {
      await apiRequest<void>(
        `/api/mobile/visitas/${visitaId}/messages/read`,
        { method: "POST" }
      );
    } catch {
      // ignore
    }
  }, [visitaId]);

  useEffect(() => {
    load().then(markRead);
    // Poll every 8s while the chat is open. Crude but reliable for v1; can
    // be replaced with WebSockets later if traffic warrants.
    const interval = setInterval(() => {
      load();
    }, 8000);
    return () => clearInterval(interval);
  }, [load, markRead]);

  // Mark read whenever new messages from the other side land.
  useEffect(() => {
    if (messages.some((m) => !m.mine)) {
      markRead();
    }
  }, [messages, markRead]);

  // Scrolling to the bottom is handled by `onContentSizeChange` on the
  // FlatList — it fires once the layout pass actually measures the new
  // content height (including async-loaded images/videos), so the scroll
  // reaches the true bottom of the last bubble.

  async function pickAttachments() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permite acceso a tus fotos para adjuntar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });
    if (result.canceled) return;

    const additions: PendingAttachment[] = await Promise.all(
      result.assets.map(async (a) => {
        const inferredName =
          a.fileName ?? a.uri.split("/").pop() ?? `media-${Date.now()}`;
        const isVideo = a.type === "video";
        const contentType = guessContentType(inferredName, isVideo);
        let thumbUri: string | undefined;
        if (isVideo) {
          try {
            const t = await VideoThumbnails.getThumbnailAsync(a.uri, {
              time: 1000,
              quality: 0.6,
            });
            thumbUri = t.uri;
          } catch {
            // fallback handled in render
          }
        }
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri: a.uri,
          fileName: inferredName,
          contentType,
          tipo: isVideo ? "video" : "imagen",
          thumbUri,
        };
      })
    );
    setPending((prev) => [...prev, ...additions].slice(0, 10));
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function uploadPending(): Promise<{ key: string; tipo: "imagen" | "video" }[]> {
    if (pending.length === 0) return [];
    const presign = await apiRequest<ChatUploadsResponse>(
      `/api/mobile/visitas/${visitaId}/messages/upload-urls`,
      {
        method: "POST",
        body: {
          files: pending.map((p) => ({
            fileName: p.fileName,
            contentType: p.contentType,
          })),
        },
      }
    );
    if (presign.uploads.length !== pending.length) {
      throw new Error("Respuesta inválida del servidor de carga.");
    }
    await Promise.all(
      pending.map(async (p, i) => {
        const upload = presign.uploads[i];
        const fileRes = await fetch(p.uri);
        const blob = await fileRes.blob();
        const putRes = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType },
          body: blob,
        });
        if (!putRes.ok) {
          throw new Error("No pudimos subir uno de los archivos.");
        }
      })
    );
    return presign.uploads.map((u) => ({ key: u.key, tipo: u.tipo }));
  }

  async function send() {
    const body = draft.trim();
    if (sending) return;
    if (!body && pending.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const uploaded = await uploadPending();
      const message = await apiRequest<ChatMessage>(
        `/api/mobile/visitas/${visitaId}/messages`,
        {
          method: "POST",
          body: {
            body: body || undefined,
            media: uploaded.length > 0 ? uploaded : undefined,
          },
        }
      );
      setMessages((prev) => [...prev, message]);
      setDraft("");
      setPending([]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  const canSend =
    !sending && (draft.trim().length > 0 || pending.length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        {searchTerm !== null ? (
          <View style={styles.headerRow}>
            <IconButton
              icon="chevron-left"
              size={24}
              onPress={() => {
                setSearchTerm(null);
                lastJumpedTermRef.current = null;
              }}
              style={styles.headerBtn}
            />
            <View style={styles.headerCenter}>
              <TextInput
                value={searchTerm}
                onChangeText={(t) => {
                  setSearchTerm(t);
                  // Reset jump so next match cycles to latest.
                  setCurrentMatchIdx(0);
                }}
                placeholder="Buscar en esta conversación"
                placeholderTextColor="#999"
                autoFocus
                style={styles.headerSearchInput}
              />
            </View>
            <View style={styles.headerBtn} />
          </View>
        ) : (
          <View style={styles.headerRow}>
            <IconButton
              icon="chevron-left"
              size={24}
              onPress={onBack}
              style={styles.headerBtn}
            />
            <View style={styles.headerCenter}>
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySmall" style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <IconButton
              icon="magnify"
              size={22}
              onPress={() => {
                setSearchTerm("");
                lastJumpedTermRef.current = null;
                setCurrentMatchIdx(0);
              }}
              style={styles.headerBtn}
            />
          </View>
        )}
      </View>

      {banner ? (
        <Pressable
          onPress={visita ? () => setDetailsOpen(true) : undefined}
          disabled={!visita}
          style={({ pressed }) => [
            styles.banner,
            pressed && visita ? styles.bannerPressed : null,
          ]}
        >
          <View
            style={[styles.bannerDot, { backgroundColor: estadoColor(banner.estado) }]}
          />
          <View style={styles.bannerText}>
            <Text variant="bodySmall" style={styles.bannerTitle} numberOfLines={1}>
              {banner.servicioNombre}
              {banner.clienteNombre ? ` · ${banner.clienteNombre}` : ""}
            </Text>
            <Text variant="bodySmall" style={styles.bannerSubtitle} numberOfLines={1}>
              {formatBannerDate(banner.fechaProgramada)} · {estadoLabel(banner.estado)}
            </Text>
          </View>
          {visita ? <Text style={styles.bannerCaret}>›</Text> : null}
        </Pressable>
      ) : null}

      {searchTerm ? (
        <SearchMatchBar
          term={searchTerm}
          messages={messages}
          currentIdx={currentMatchIdx}
          onChangeIdx={(nextIdx, msgIdx) => {
            setCurrentMatchIdx(nextIdx);
            isAtBottomRef.current = false;
            listRef.current?.scrollToIndex({
              index: msgIdx,
              animated: true,
              viewPosition: 0.5,
            });
          }}
          onClose={() => {
            setSearchTerm(null);
            lastJumpedTermRef.current = null;
          }}
        />
      ) : null}

      {visita ? (
        <VisitaDetailsSheet
          visible={detailsOpen}
          visita={visita}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        (() => {
          const lastSameSideIndex = (() => {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].sameSide) return i;
            }
            return -1;
          })();
          const term = searchTerm?.toLowerCase() ?? "";
          const matchIndices: number[] = [];
          if (term) {
            messages.forEach((m, i) => {
              if (m.body && m.body.toLowerCase().includes(term)) {
                matchIndices.push(i);
              }
            });
          }
          const matchSet = new Set(matchIndices);
          const currentMatchListIdx = matchIndices.length
            ? Math.min(currentMatchIdx, matchIndices.length - 1)
            : -1;
          const currentMessageIdx =
            currentMatchListIdx >= 0
              ? matchIndices[currentMatchListIdx]
              : -1;
          // Auto-jump on search term change. If an initialMessageId was
          // passed (user clicked a specific message-match result), jump to
          // that exact message; otherwise jump to the latest match.
          if (
            term &&
            term !== lastJumpedTermRef.current &&
            matchIndices.length > 0 &&
            messages.length > 0
          ) {
            lastJumpedTermRef.current = term;
            let targetMatchIdx = matchIndices.length - 1;
            const wantedId = initialMessageIdRef.current;
            if (wantedId) {
              const wantedIdx = messages.findIndex((m) => m.id === wantedId);
              const inMatches = matchIndices.indexOf(wantedIdx);
              if (inMatches >= 0) targetMatchIdx = inMatches;
              initialMessageIdRef.current = undefined;
            }
            const targetMessageIdx = matchIndices[targetMatchIdx];
            setTimeout(() => {
              setCurrentMatchIdx(targetMatchIdx);
              isAtBottomRef.current = false;
              listRef.current?.scrollToIndex({
                index: targetMessageIdx,
                animated: false,
                viewPosition: 0.5,
              });
            }, 100);
          } else if (!term) {
            lastJumpedTermRef.current = null;
          }
          return (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.listContent}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } =
                  e.nativeEvent;
                const distanceFromBottom =
                  contentSize.height -
                  (contentOffset.y + layoutMeasurement.height);
                isAtBottomRef.current = distanceFromBottom < 80;
              }}
              scrollEventThrottle={32}
              onContentSizeChange={() => {
                if (isAtBottomRef.current) {
                  listRef.current?.scrollToEnd({ animated: false });
                }
              }}
              onScrollToIndexFailed={(info) => {
                // FlatList can fail to scroll to an off-screen index when it
                // hasn't been measured yet. Wait a tick and retry.
                setTimeout(() => {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0.5,
                  });
                }, 200);
              }}
              renderItem={({ item, index }) => {
                const prev = index > 0 ? messages[index - 1] : null;
                // Show author label whenever the author isn't me — including
                // other admins/staff so multi-person team chats are clear.
                const showAuthor =
                  !item.mine &&
                  (!prev ||
                    prev.authorUserId !== item.authorUserId ||
                    tooFarApart(prev.createdAt, item.createdAt));
                const showTime =
                  !prev || tooFarApart(prev.createdAt, item.createdAt);
                const isLastSameSide = index === lastSameSideIndex;
                const wasRead =
                  isLastSameSide &&
                  peerLastReadAt !== null &&
                  new Date(peerLastReadAt).getTime() >=
                    new Date(item.createdAt).getTime();
                return (
                  <View
                    style={[
                      styles.bubbleWrap,
                      item.sameSide
                        ? styles.bubbleWrapMine
                        : styles.bubbleWrapTheirs,
                    ]}
                  >
                    {showTime ? (
                      <Text variant="bodySmall" style={styles.timestamp}>
                        {formatTime(item.createdAt)}
                      </Text>
                    ) : null}
                    {showAuthor ? (
                      <Text variant="bodySmall" style={styles.authorLabel}>
                        {item.authorName}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        styles.bubble,
                        item.sameSide
                          ? styles.bubbleMine
                          : styles.bubbleTheirs,
                        matchSet.has(index) && styles.bubbleHighlighted,
                        index === currentMessageIdx &&
                          styles.bubbleCurrentMatch,
                      ]}
                    >
                      {item.media.length > 0 ? (
                        <View
                          style={[
                            styles.bubbleMedia,
                            item.body ? { marginBottom: 8 } : null,
                          ]}
                        >
                          {item.media.map((m) => (
                            <BubbleMedia
                              key={m.id}
                              media={m}
                              onPress={() =>
                                setActiveMedia({ url: m.url, tipo: m.tipo })
                              }
                            />
                          ))}
                        </View>
                      ) : null}
                      {item.body ? (
                        <Text
                          style={[
                            styles.bubbleText,
                            item.sameSide
                              ? styles.bubbleTextMine
                              : styles.bubbleTextTheirs,
                          ]}
                        >
                          {item.body}
                        </Text>
                      ) : null}
                    </View>
                    {isLastSameSide ? (
                      <Text variant="bodySmall" style={styles.readReceipt}>
                        {wasRead ? "Leído" : "Enviado"}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text variant="bodyMedium" style={styles.emptyTitle}>
                    Sin mensajes todavía
                  </Text>
                  <Text variant="bodySmall" style={styles.emptyBody}>
                    Escribe algo para empezar la conversación.
                  </Text>
                </View>
              }
            />
          );
        })()
      )}

      {error ? (
        <View style={styles.errorBar}>
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {pending.length > 0 ? (
        <View style={styles.pendingRow}>
          {pending.map((p) => (
            <View key={p.id} style={styles.pendingItem}>
              {p.tipo === "imagen" ? (
                <Image source={{ uri: p.uri }} style={styles.pendingThumb} />
              ) : p.thumbUri ? (
                <>
                  <Image
                    source={{ uri: p.thumbUri }}
                    style={styles.pendingThumb}
                  />
                  <View style={styles.pendingPlayBadge}>
                    <Text style={styles.pendingPlayIcon}>▶</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.pendingThumb, styles.pendingVideoFallback]}>
                  <Text style={styles.pendingVideoLabel}>Video</Text>
                </View>
              )}
              <Pressable
                onPress={() => removePending(p.id)}
                hitSlop={8}
                style={styles.pendingRemove}
                disabled={sending}
              >
                <Text style={styles.pendingRemoveX}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
        ]}
      >
        <Pressable
          onPress={pickAttachments}
          disabled={sending || pending.length >= 10}
          hitSlop={6}
          style={({ pressed }) => [
            styles.attachBtn,
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          <Text style={styles.attachIcon}>＋</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribir mensaje"
          placeholderTextColor="#999"
          multiline
          style={styles.composerInput}
          editable={!sending}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            !canSend && styles.sendBtnDisabled,
            pressed && canSend && { opacity: 0.85 },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnLabel}>↑</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SearchMatchBar({
  term,
  messages,
  currentIdx,
  onChangeIdx,
  onClose,
}: {
  term: string;
  messages: ChatMessage[];
  currentIdx: number;
  onChangeIdx: (nextIdx: number, msgIdx: number) => void;
  onClose: () => void;
}) {
  const lower = term.toLowerCase();
  const matches: number[] = [];
  messages.forEach((m, i) => {
    if (m.body && m.body.toLowerCase().includes(lower)) matches.push(i);
  });

  const total = matches.length;
  const safeIdx = total === 0 ? 0 : Math.min(currentIdx, total - 1);
  const counter = total === 0 ? "Sin coincidencias" : `${safeIdx + 1} de ${total}`;

  return (
    <View style={styles.searchBar}>
      <View style={{ flex: 1 }}>
        <Text variant="bodySmall" style={styles.searchBarLabel} numberOfLines={1}>
          Buscando "{term}"
        </Text>
        <Text variant="bodySmall" style={styles.searchBarCounter}>
          {counter}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          if (total === 0) return;
          const next = (safeIdx - 1 + total) % total;
          onChangeIdx(next, matches[next]);
        }}
        disabled={total === 0}
        hitSlop={6}
        style={({ pressed }) => [
          styles.searchBarBtn,
          (total === 0 || pressed) && { opacity: 0.4 },
        ]}
      >
        <Text style={styles.searchBarBtnIcon}>↑</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (total === 0) return;
          const next = (safeIdx + 1) % total;
          onChangeIdx(next, matches[next]);
        }}
        disabled={total === 0}
        hitSlop={6}
        style={({ pressed }) => [
          styles.searchBarBtn,
          (total === 0 || pressed) && { opacity: 0.4 },
        ]}
      >
        <Text style={styles.searchBarBtnIcon}>↓</Text>
      </Pressable>
      <Pressable
        onPress={onClose}
        hitSlop={6}
        style={({ pressed }) => [
          styles.searchBarBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.searchBarBtnIcon}>×</Text>
      </Pressable>
    </View>
  );
}

function BubbleMedia({
  media,
  onPress,
}: {
  media: ChatMediaItem;
  onPress: () => void;
}) {
  const [thumbUri, setThumbUri] = useState<string | undefined>(undefined);
  const isVideo = media.tipo === "video";

  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await VideoThumbnails.getThumbnailAsync(media.url, {
          time: 1000,
          quality: 0.6,
        });
        if (!cancelled) setThumbUri(t.uri);
      } catch {
        // ignore — falls back to placeholder
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVideo, media.url]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bubbleMediaItem,
        pressed && { opacity: 0.85 },
      ]}
    >
      {!isVideo ? (
        <Image source={{ uri: media.url }} style={styles.bubbleMediaImage} />
      ) : thumbUri ? (
        <>
          <Image source={{ uri: thumbUri }} style={styles.bubbleMediaImage} />
          <View style={styles.bubbleMediaPlayBadge}>
            <Text style={styles.bubbleMediaPlayIcon}>▶</Text>
          </View>
        </>
      ) : (
        <View style={[styles.bubbleMediaImage, styles.bubbleMediaVideoFallback]}>
          <Text style={styles.bubbleMediaVideoLabel}>▶ Video</Text>
        </View>
      )}
    </Pressable>
  );
}

function VisitaDetailsSheet({
  visible,
  visita,
  onClose,
}: {
  visible: boolean;
  visita: VisitaDetail;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({});
  // Own MediaViewer state — RN's iOS Modal can't have two sibling Modals open
  // at the same time, so the sheet renders its own viewer as a child.
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(null);

  useEffect(() => {
    if (!visible) return;
    const videos = visita.media.filter((m) => m.tipo === "video");
    let cancelled = false;
    videos.forEach(async (m) => {
      if (videoThumbs[m.id]) return;
      try {
        const t = await VideoThumbnails.getThumbnailAsync(m.url, {
          time: 1000,
          quality: 0.6,
        });
        if (!cancelled) {
          setVideoThumbs((prev) => ({ ...prev, [m.id]: t.uri }));
        }
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, visita.media, videoThumbs]);

  const personalAsignado = visita.personal ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[detailsStyles.container, { paddingTop: insets.top }]}>
        <View style={detailsStyles.header}>
          <View style={{ width: 40 }} />
          <Text variant="titleMedium" style={detailsStyles.headerTitle}>
            Detalles de la visita
          </Text>
          <IconButton icon="close" size={24} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={detailsStyles.scroll}>
          <View style={detailsStyles.hero}>
            <View
              style={[
                detailsStyles.estadoChip,
                { backgroundColor: estadoBg(visita.estado) },
              ]}
            >
              <View
                style={[
                  detailsStyles.estadoDot,
                  { backgroundColor: estadoColor(visita.estado) },
                ]}
              />
              <Text variant="bodySmall" style={detailsStyles.estadoLabel}>
                {estadoLabel(visita.estado)}
              </Text>
            </View>
            <Text variant="headlineSmall" style={detailsStyles.heroTitle}>
              {visita.clienteServicio.servicio.nombre}
            </Text>
            <Text variant="bodyMedium" style={detailsStyles.heroSubtitle}>
              {formatBannerDate(visita.fechaProgramada)}
            </Text>
          </View>

          <DetailsSection title="Cuándo">
            <DetailsRow
              label="Programada"
              value={formatBannerDate(visita.fechaProgramada)}
            />
            {visita.fechaRealizada ? (
              <DetailsRow
                label="Realizada"
                value={formatBannerDate(visita.fechaRealizada)}
              />
            ) : null}
            {visita.horaEntrada ? (
              <DetailsRow
                label={
                  visita.estado === "PROGRAMADA"
                    ? "Hora estimada"
                    : "Hora de entrada"
                }
                value={visita.horaEntrada}
              />
            ) : null}
            {visita.horaSalida ? (
              <DetailsRow label="Hora de salida" value={visita.horaSalida} />
            ) : null}
          </DetailsSection>

          {personalAsignado.length > 0 ? (
            <DetailsSection title="Personal asignado">
              {personalAsignado.map((p) => (
                <View key={p.personalId} style={detailsStyles.personRow}>
                  <Text variant="bodyMedium" style={detailsStyles.personName}>
                    {`${p.personal.nombre} ${p.personal.apellido ?? ""}`.trim()}
                  </Text>
                  {p.personal.tipo ? (
                    <Text variant="bodySmall" style={detailsStyles.personTipo}>
                      {tipoLabel(p.personal.tipo)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </DetailsSection>
          ) : null}

          {visita.notas || visita.notasIncompleto ? (
            <DetailsSection
              title={
                visita.estado === "INCOMPLETA" || visita.estado === "CANCELADA"
                  ? "Motivo"
                  : "Notas"
              }
            >
              <Text variant="bodyMedium" style={detailsStyles.notasText}>
                {visita.notasIncompleto || visita.notas}
              </Text>
            </DetailsSection>
          ) : null}

          {visita.media && visita.media.length > 0 ? (
            <View style={detailsStyles.mediaSection}>
              <Text variant="labelMedium" style={detailsStyles.sectionLabel}>
                ARCHIVOS
              </Text>
              <View style={detailsStyles.mediaGrid}>
                {visita.media.map((m) => (
                  <DetailsMediaTile
                    key={m.id}
                    item={m}
                    thumbUri={videoThumbs[m.id]}
                    onPress={() =>
                      setActiveMedia({ url: m.url, tipo: m.tipo })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <MediaViewer
          media={activeMedia}
          onClose={() => setActiveMedia(null)}
        />
      </View>
    </Modal>
  );
}

function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={detailsStyles.section}>
      <Text variant="labelMedium" style={detailsStyles.sectionLabel}>
        {title.toUpperCase()}
      </Text>
      <View style={detailsStyles.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? (
              <View style={detailsStyles.rowDivider} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailsStyles.row}>
      <Text variant="bodyMedium" style={detailsStyles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={detailsStyles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

function DetailsMediaTile({
  item,
  thumbUri,
  onPress,
}: {
  item: VisitaMedia;
  thumbUri?: string;
  onPress: () => void;
}) {
  const isVideo = item.tipo === "video";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        detailsStyles.mediaTile,
        pressed && { opacity: 0.7 },
      ]}
    >
      {isVideo ? (
        thumbUri ? (
          <>
            <Image source={{ uri: thumbUri }} style={detailsStyles.mediaTileImage} />
            <View style={detailsStyles.playBadge}>
              <Text style={detailsStyles.playBadgeIcon}>▶</Text>
            </View>
          </>
        ) : (
          <View
            style={[detailsStyles.mediaTileImage, detailsStyles.videoTile]}
          >
            <Text style={detailsStyles.videoLabel}>▶ Video</Text>
          </View>
        )
      ) : (
        <Image source={{ uri: item.url }} style={detailsStyles.mediaTileImage} />
      )}
    </Pressable>
  );
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecánico";
    default:
      return tipo;
  }
}

function estadoBg(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "#e8f5e9";
    case "COMPLETADA":
      return "#f0f0f0";
    case "INCOMPLETA":
      return "#fff3e0";
    case "CANCELADA":
      return "#ffebee";
    default:
      return "#f4f4f4";
  }
}

function guessContentType(name: string, isVideo: boolean): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (isVideo) {
    if (ext === "mov") return "video/quicktime";
    if (ext === "m4v") return "video/x-m4v";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function estadoLabel(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "Programada";
    case "COMPLETADA":
      return "Completada";
    case "INCOMPLETA":
      return "Incompleta";
    case "CANCELADA":
      return "Cancelada";
    default:
      return estado;
  }
}

function estadoColor(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "#2e7d32";
    case "COMPLETADA":
      return "#9e9e9e";
    case "INCOMPLETA":
      return "#f57c00";
    case "CANCELADA":
      return "#c62828";
    default:
      return "#bdbdbd";
  }
}

function formatBannerDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function tooFarApart(prevIso: string, nextIso: string): boolean {
  const diff = new Date(nextIso).getTime() - new Date(prevIso).getTime();
  return diff > 1000 * 60 * 5; // 5 minutes
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  headerBtn: { margin: 0, width: 40 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#111", fontWeight: "600" },
  headerSubtitle: { color: "#888" },
  headerSearchInput: {
    backgroundColor: "#f4f4f4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: "#111",
    width: "100%",
  },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    gap: 12,
  },
  bannerPressed: { backgroundColor: "#f0f0f0" },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { color: "#111", fontWeight: "500" },
  bannerSubtitle: { color: "#888", textTransform: "capitalize" },
  bannerCaret: { color: "#bbb", fontSize: 24, lineHeight: 24, marginLeft: 4 },

  listContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    padding: 16,
    gap: 6,
  },

  bubbleWrap: { gap: 4 },
  bubbleWrapMine: { alignItems: "flex-end" },
  bubbleWrapTheirs: { alignItems: "flex-start" },
  timestamp: {
    color: "#999",
    alignSelf: "center",
    marginVertical: 8,
  },
  authorLabel: {
    color: "#888",
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: "#2e7d32",
    borderBottomRightRadius: 6,
    alignSelf: "flex-end",
  },
  bubbleTheirs: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 6,
    alignSelf: "flex-start",
  },
  readReceipt: {
    color: "#888",
    paddingHorizontal: 6,
    marginTop: 2,
  },
  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: "#fbc02d",
  },
  bubbleCurrentMatch: {
    borderColor: "#f57f17",
    shadowColor: "#f57f17",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff8e1",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0e0a0",
    gap: 6,
  },
  searchBarLabel: {
    color: "#5d4037",
    fontWeight: "500",
  },
  searchBarCounter: {
    color: "#8d6e63",
  },
  searchBarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarBtnIcon: {
    color: "#5d4037",
    fontSize: 18,
    fontWeight: "600",
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleTextTheirs: { color: "#111" },
  bubbleMedia: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    maxWidth: 280,
  },
  bubbleMediaItem: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#222",
    position: "relative",
  },
  bubbleMediaImage: {
    width: "100%",
    height: "100%",
  },
  bubbleMediaVideoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleMediaVideoLabel: { color: "#fff", fontWeight: "600" },
  bubbleMediaPlayBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleMediaPlayIcon: { color: "#fff", fontSize: 16, marginLeft: 2 },

  empty: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888" },

  errorBar: {
    backgroundColor: "#fdecea",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: { color: "#c62828" },

  pendingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  pendingItem: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#f0f0f0",
  },
  pendingThumb: { width: "100%", height: "100%" },
  pendingVideoFallback: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingVideoLabel: { color: "#fff", fontWeight: "600", fontSize: 11 },
  pendingPlayBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPlayIcon: { color: "#fff", fontSize: 11, marginLeft: 1 },
  pendingRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingRemoveX: { color: "#fff", fontSize: 12, lineHeight: 13 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  attachIcon: { color: "#2e7d32", fontSize: 22, fontWeight: "600", lineHeight: 22 },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#f4f4f4",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#111",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#bbb" },
  sendBtnLabel: { color: "#fff", fontSize: 18, fontWeight: "700" },
});

const detailsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerTitle: { color: "#111", fontWeight: "600" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  hero: { paddingVertical: 8, paddingBottom: 16, gap: 6 },
  heroTitle: { color: "#111", fontWeight: "700" },
  heroSubtitle: { color: "#777", textTransform: "capitalize" },
  estadoChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
    marginBottom: 4,
  },
  estadoDot: { width: 7, height: 7, borderRadius: 4 },
  estadoLabel: { fontWeight: "500", color: "#222" },

  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: {
    color: "#111",
    textAlign: "right",
    flexShrink: 1,
    textTransform: "capitalize",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  personName: { color: "#111", flexShrink: 1 },
  personTipo: { color: "#888" },

  notasText: {
    color: "#222",
    paddingVertical: 12,
    lineHeight: 22,
  },

  mediaSection: { marginTop: 20, gap: 8 },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
  },
  mediaTile: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  mediaTileImage: { width: "100%", height: "100%" },
  videoTile: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  videoLabel: { color: "#fff", fontWeight: "600" },
  playBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadgeIcon: { color: "#fff", fontSize: 14, marginLeft: 2 },
});
