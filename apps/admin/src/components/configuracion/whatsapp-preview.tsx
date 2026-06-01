"use client";

import React from "react";

interface WhatsAppPreviewProps {
  content: string;
}

function parseWhatsAppFormatting(text: string): React.ReactNode[] {
  // Escape HTML-like content
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Replace WhatsApp formatting with HTML markers
  // Order matters: process bold, italic, strikethrough
  // Bold: *text*
  escaped = escaped.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  // Italic: _text_
  escaped = escaped.replace(/\_([^_\n]+)\_/g, '<em>$1</em>');
  // Strikethrough: ~text~
  escaped = escaped.replace(/\~([^~\n]+)\~/g, '<s>$1</s>');
  // Variables: {{varName}} -> highlighted chip
  escaped = escaped.replace(
    /\{\{([^}]+)\}\}/g,
    '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono">$1</span>'
  );
  // Newlines -> <br/>
  escaped = escaped.replace(/\n/g, '<br/>');

  return [
    <span
      key="content"
      dangerouslySetInnerHTML={{ __html: escaped }}
    />,
  ];
}

export function WhatsAppPreview({ content }: WhatsAppPreviewProps) {
  if (!content.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        La vista previa aparecerá aquí
      </div>
    );
  }

  return (
    <div className="bg-[#e5ddd5] rounded-lg p-4 min-h-40">
      <div className="max-w-sm">
        <div className="bg-[#dcf8c6] rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
          <div className="text-sm leading-relaxed break-words">
            {parseWhatsAppFormatting(content)}
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-gray-500">12:00 p.m.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
