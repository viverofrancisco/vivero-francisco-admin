"use client";

import { useRef, useCallback, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Strikethrough, Braces, Search } from "lucide-react";

interface WhatsAppEditorProps {
  content: string;
  onChange: (content: string) => void;
  variables: string[];
  disabled?: boolean;
}

export function WhatsAppEditor({
  content,
  onChange,
  variables,
  disabled = false,
}: WhatsAppEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback(
    (marker: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = content;

      if (start === end) {
        // No selection: insert markers and place cursor between them
        const newText =
          text.slice(0, start) + marker + marker + text.slice(end);
        onChange(newText);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + marker.length,
            start + marker.length
          );
        });
      } else {
        // Wrap selected text
        const selected = text.slice(start, end);
        const newText =
          text.slice(0, start) + marker + selected + marker + text.slice(end);
        onChange(newText);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + marker.length,
            end + marker.length
          );
        });
      }
    },
    [content, onChange]
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const tag = `{{${varName}}}`;
      const newText = content.slice(0, start) + tag + content.slice(start);
      onChange(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      });
    },
    [content, onChange]
  );

  const [varsOpen, setVarsOpen] = useState(false);
  const [varsSearch, setVarsSearch] = useState("");
  const varsRef = useRef<HTMLDivElement>(null);

  const filteredVars = useMemo(() => {
    const q = varsSearch.toLowerCase().trim();
    return q ? variables.filter((v) => v.toLowerCase().includes(q)) : variables;
  }, [variables, varsSearch]);

  // Close dropdown on outside click
  const handleVarSelect = useCallback(
    (varName: string) => {
      insertVariable(varName);
      setVarsOpen(false);
      setVarsSearch("");
    },
    [insertVariable]
  );

  const charCount = content.length;
  const isOverLimit = charCount > 1024;
  const isNearLimit = charCount > 900;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => wrapSelection("*")}
          title="Negrita"
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => wrapSelection("_")}
          title="Cursiva"
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => wrapSelection("~")}
          title="Tachado"
          disabled={disabled}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Variables dropdown */}
        <div className="relative" ref={varsRef}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5"
            onClick={() => {
              setVarsOpen((prev) => !prev);
              setVarsSearch("");
            }}
            title="Insertar variable"
            disabled={disabled}
          >
            <Braces className="h-4 w-4" />
            <span className="text-xs">Variables</span>
          </Button>

          {varsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setVarsOpen(false);
                  setVarsSearch("");
                }}
              />
              <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border bg-white shadow-md">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar variable..."
                      value={varsSearch}
                      onChange={(e) => setVarsSearch(e.target.value)}
                      className="h-8 pl-8 text-sm border-0 shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {filteredVars.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      No se encontraron variables
                    </p>
                  ) : (
                    filteredVars.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="w-full text-left rounded-md px-3 py-1.5 text-sm hover:bg-muted cursor-pointer font-mono"
                        onClick={() => handleVarSelect(v)}
                      >
                        {`{{${v}}}`}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-40 font-mono text-sm"
        placeholder="Escribe el contenido de la notificación..."
        disabled={disabled}
      />

      {/* Character counter */}
      <div className="flex justify-end">
        <span
          className={`text-xs ${
            isOverLimit
              ? "text-destructive font-medium"
              : isNearLimit
                ? "text-amber-500"
                : "text-muted-foreground"
          }`}
        >
          {charCount} / 1024
        </span>
      </div>
    </div>
  );
}
