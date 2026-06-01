"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Paperclip,
  Play,
  Search,
  Send,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { toast } from "sonner";

interface ChatMediaItem {
  id: string;
  url: string;
  tipo: "imagen" | "video";
}

interface ChatMessage {
  id: string;
  visitaId: string;
  authorUserId: string;
  authorRole: string;
  authorName: string;
  body: string | null;
  media: ChatMediaItem[];
  createdAt: string;
  mine: boolean;
  sameSide: boolean;
}

interface ChatListResponse {
  items: ChatMessage[];
  nextCursor: string | null;
  peerLastReadAt: string | null;
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

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  tipo: "imagen" | "video";
}

export function VisitaChatPanel({
  visitaId,
  initialSearch,
  initialMessageId,
  fillHeight = false,
}: {
  visitaId: string;
  initialSearch?: string;
  initialMessageId?: string;
  // When true, the chat fills its parent's height (used in two-column
  // layouts). Otherwise it uses a fixed h-80 like the embedded panel.
  fillHeight?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string | null>(
    initialSearch?.trim() || null
  );
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);
  // Re-jump to the latest match each time the search term changes; don't
  // re-jump when only the messages list updates (polling).
  const lastJumpedTermRef = useRef<string | null>(null);
  const initialMessageIdRef = useRef<string | undefined>(initialMessageId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/visitas/${visitaId}/messages?limit=200`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("load failed");
      const data: ChatListResponse = await res.json();
      setMessages(data.items);
      setPeerLastReadAt(data.peerLastReadAt);
    } catch {
      // ignore — keep prior state
    } finally {
      setLoading(false);
    }
  }, [visitaId]);

  const markRead = useCallback(async () => {
    try {
      await fetch(`/api/admin/visitas/${visitaId}/messages/read`, {
        method: "POST",
      });
    } catch {
      // ignore
    }
  }, [visitaId]);

  useEffect(() => {
    load().then(markRead);
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load, markRead]);

  // Auto-scroll to bottom on new messages — but not while the user is
  // navigating search matches.
  useEffect(() => {
    if (searchTerm) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, searchTerm]);

  // Auto-jump on search term change. If initialMessageId was provided
  // (user clicked a specific message-match result), jump to that exact
  // message; otherwise jump to the latest match.
  useEffect(() => {
    if (!searchTerm) {
      lastJumpedTermRef.current = null;
      return;
    }
    const term = searchTerm.toLowerCase();
    if (lastJumpedTermRef.current === term) return;
    if (messages.length === 0) return;
    const matches: number[] = [];
    messages.forEach((m, i) => {
      if (m.body && m.body.toLowerCase().includes(term)) matches.push(i);
    });
    lastJumpedTermRef.current = term;
    if (matches.length === 0) return;
    let targetIdx = matches.length - 1;
    const wantedId = initialMessageIdRef.current;
    if (wantedId) {
      const idxInMessages = messages.findIndex((m) => m.id === wantedId);
      const inMatches = matches.indexOf(idxInMessages);
      if (inMatches >= 0) targetIdx = inMatches;
      initialMessageIdRef.current = undefined;
    }
    setCurrentMatchIdx(targetIdx);
    setTimeout(() => {
      scrollToMessage(messages[matches[targetIdx]].id);
    }, 50);
  }, [searchTerm, messages]);

  function scrollToMessage(id: string) {
    const el = messageRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "auto", block: "center" });
  }

  // Mark read when new messages from the other side arrive.
  useEffect(() => {
    if (messages.some((m) => !m.mine)) markRead();
  }, [messages, markRead]);

  // Cleanup blob URLs when pending attachments are dropped.
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const additions: PendingAttachment[] = Array.from(files).map((file) => {
      const tipo: "imagen" | "video" = file.type.startsWith("video/")
        ? "video"
        : "imagen";
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        tipo,
      };
    });
    setPending((prev) => [...prev, ...additions].slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function uploadPending(): Promise<{ key: string; tipo: "imagen" | "video" }[]> {
    if (pending.length === 0) return [];
    const presignRes = await fetch(
      `/api/admin/visitas/${visitaId}/messages/upload-urls`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: pending.map((p) => ({
            fileName: p.file.name,
            contentType: p.file.type || "application/octet-stream",
          })),
        }),
      }
    );
    if (!presignRes.ok) throw new Error("presign failed");
    const presign: ChatUploadsResponse = await presignRes.json();
    if (presign.uploads.length !== pending.length) {
      throw new Error("respuesta inválida del servidor de carga");
    }
    await Promise.all(
      pending.map(async (p, i) => {
        const upload = presign.uploads[i];
        const putRes = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType },
          body: p.file,
        });
        if (!putRes.ok) throw new Error("upload failed");
      })
    );
    return presign.uploads.map((u) => ({ key: u.key, tipo: u.tipo }));
  }

  async function send() {
    const body = draft.trim();
    if (sending) return;
    if (!body && pending.length === 0) return;
    setSending(true);
    try {
      const uploaded = await uploadPending();
      const res = await fetch(`/api/admin/visitas/${visitaId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body || undefined,
          media: uploaded.length > 0 ? uploaded : undefined,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      const message: ChatMessage = await res.json();
      setMessages((prev) => [...prev, message]);
      setDraft("");
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
    } catch {
      toast.error("No pudimos enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={fillHeight ? "flex h-full flex-col" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        {searchTerm !== null ? (
          <div className="flex w-full items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentMatchIdx(0);
                }}
                placeholder="Buscar en esta conversación"
                autoFocus
                className="pl-9"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchTerm(null);
                lastJumpedTermRef.current = null;
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <CardTitle>Chat</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchTerm("");
                lastJumpedTermRef.current = null;
                setCurrentMatchIdx(0);
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent
        className={fillHeight ? "flex flex-1 flex-col min-h-0" : undefined}
      >
        {searchTerm ? (
          <SearchMatchBar
            term={searchTerm}
            messages={messages}
            currentIdx={currentMatchIdx}
            onChangeIdx={(nextIdx, msgId) => {
              setCurrentMatchIdx(nextIdx);
              scrollToMessage(msgId);
            }}
            onClose={() => {
              setSearchTerm(null);
              lastJumpedTermRef.current = null;
            }}
          />
        ) : null}
        <div
          ref={scrollRef}
          className={
            (fillHeight
              ? "flex-1 min-h-0 "
              : "h-80 ") +
            "overflow-y-auto rounded-md border bg-muted/30 p-4 space-y-3"
          }
        >
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Cargando…
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Sin mensajes todavía. Empieza la conversación.
            </p>
          ) : (
            (() => {
              let lastSameSideIndex = -1;
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].sameSide) {
                  lastSameSideIndex = i;
                  break;
                }
              }
              const lower = searchTerm?.toLowerCase() ?? "";
              const matchIndices: number[] = [];
              if (lower) {
                messages.forEach((m, i) => {
                  if (m.body && m.body.toLowerCase().includes(lower))
                    matchIndices.push(i);
                });
              }
              const matchSet = new Set(matchIndices);
              const currentMessageIdx =
                matchIndices.length > 0
                  ? matchIndices[
                      Math.min(currentMatchIdx, matchIndices.length - 1)
                    ]
                  : -1;
              return messages.map((m, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                // Show author label for messages I didn't write — including
                // other admins so the team can tell each other apart.
                const showAuthor =
                  !m.mine &&
                  (!prev ||
                    prev.authorUserId !== m.authorUserId ||
                    diffMinutes(prev.createdAt, m.createdAt) > 5);
                const showTime =
                  !prev || diffMinutes(prev.createdAt, m.createdAt) > 5;
                const isLastSameSide = i === lastSameSideIndex;
                const wasRead =
                  isLastSameSide &&
                  peerLastReadAt !== null &&
                  new Date(peerLastReadAt).getTime() >=
                    new Date(m.createdAt).getTime();
                const isMatch = matchSet.has(i);
                const isCurrentMatch = i === currentMessageIdx;
                return (
                  <div
                    key={m.id}
                    ref={(el) => {
                      if (el) messageRefs.current.set(m.id, el);
                      else messageRefs.current.delete(m.id);
                    }}
                    className="space-y-1"
                  >
                    {showTime ? (
                      <p className="text-xs text-muted-foreground text-center">
                        {formatTime(m.createdAt)}
                      </p>
                    ) : null}
                    <div
                      className={
                        "w-fit max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words " +
                        (m.sameSide
                          ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                          : "mr-auto bg-background border rounded-bl-sm") +
                        (isMatch ? " ring-2 ring-yellow-400" : "") +
                        (isCurrentMatch ? " ring-yellow-600 shadow-md" : "")
                      }
                    >
                      {showAuthor ? (
                        <p className="text-xs font-semibold opacity-70 mb-0.5">
                          {m.authorName}
                        </p>
                      ) : null}
                      {m.media.length > 0 ? (
                        <div
                          className={`flex flex-wrap gap-2 ${m.body ? "mb-2" : ""}`}
                        >
                          {m.media.map((media) => (
                            <BubbleMedia
                              key={media.id}
                              media={media}
                              onOpen={() =>
                                setActiveMedia({
                                  url: media.url,
                                  tipo: media.tipo,
                                })
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                      {m.body ? <p>{m.body}</p> : null}
                    </div>
                    {isLastSameSide ? (
                      <p className="text-xs text-muted-foreground text-right pr-1">
                        {wasRead ? "Leído" : "Enviado"}
                      </p>
                    ) : null}
                  </div>
                );
              });
            })()
          )}
        </div>

        {pending.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="relative w-16 h-16 rounded-md overflow-hidden bg-muted"
              >
                {p.tipo === "imagen" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={p.previewUrl}
                    className="w-full h-full object-cover"
                    muted
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  disabled={sending}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || pending.length >= 10}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribir mensaje"
            rows={2}
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            onClick={send}
            disabled={
              sending || (draft.trim().length === 0 && pending.length === 0)
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </Card>
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
  onChangeIdx: (nextIdx: number, msgId: string) => void;
  onClose: () => void;
}) {
  const lower = term.toLowerCase();
  const matches: { idx: number; id: string }[] = [];
  messages.forEach((m, i) => {
    if (m.body && m.body.toLowerCase().includes(lower))
      matches.push({ idx: i, id: m.id });
  });

  const total = matches.length;
  const safeIdx = total === 0 ? 0 : Math.min(currentIdx, total - 1);
  const counter =
    total === 0 ? "Sin coincidencias" : `${safeIdx + 1} de ${total}`;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-yellow-900">
          Buscando &quot;{term}&quot;
        </p>
        <p className="text-xs text-yellow-800">{counter}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={total === 0}
        onClick={() => {
          if (total === 0) return;
          const next = (safeIdx - 1 + total) % total;
          onChangeIdx(next, matches[next].id);
        }}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={total === 0}
        onClick={() => {
          if (total === 0) return;
          const next = (safeIdx + 1) % total;
          onChangeIdx(next, matches[next].id);
        }}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BubbleMedia({
  media,
  onOpen,
}: {
  media: ChatMediaItem;
  onOpen: () => void;
}) {
  if (media.tipo === "video") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative block overflow-hidden rounded-md bg-black"
      >
        <video
          src={media.url}
          muted
          className="max-w-[240px] max-h-60 object-cover pointer-events-none"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
            <Play className="h-5 w-5 fill-white text-white" />
          </span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block overflow-hidden rounded-md"
    >
      <Image
        src={media.url}
        alt=""
        width={240}
        height={240}
        unoptimized
        className="max-w-[240px] max-h-60 object-cover"
      />
    </button>
  );
}

function diffMinutes(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function formatTime(iso: string): string {
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
  return d.toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
