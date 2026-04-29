import type { WhatsAppProvider, TemplateComponent, SendResult } from "./types";

const API_VERSION = "v21.0";

export interface TemplateResult {
  success: boolean;
  templateId?: string;
  status?: string;
  error?: string;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  private token: string;
  private phoneNumberId: string;

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  private get baseUrl() {
    return `https://graph.facebook.com/${API_VERSION}/${this.phoneNumberId}/messages`;
  }

  private async send(body: Record<string, unknown>): Promise<SendResult> {
    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.messages?.[0]?.id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components: TemplateComponent[]
  ): Promise<SendResult> {
    return this.send({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: components.length > 0 ? components : undefined,
      },
    });
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    return this.send({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    });
  }

  // ──────────────────────────────────────────────
  // Template Management (Meta Business API)
  // ──────────────────────────────────────────────

  async createTemplate(
    businessId: string,
    name: string,
    language: string,
    bodyText: string,
    exampleValues?: string[],
    category: "UTILITY" | "AUTHENTICATION" | "MARKETING" = "UTILITY"
  ): Promise<TemplateResult> {
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates`;

      // Build BODY component with example values if variables exist
      const bodyComponent: Record<string, unknown> = {
        type: "BODY",
        text: bodyText,
      };

      // Meta requires example values for templates with variables
      if (exampleValues && exampleValues.length > 0) {
        bodyComponent.example = {
          body_text: [exampleValues],
        };
      }

      const requestBody = {
        name,
        language,
        category,
        components: [bodyComponent],
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        templateId: data.id,
        status: data.status,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  }

  async getTemplateStatus(
    businessId: string,
    templateName: string
  ): Promise<TemplateResult> {
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates?name=${encodeURIComponent(templateName)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `HTTP ${res.status}`,
        };
      }

      const template = data.data?.[0];
      if (!template) {
        return {
          success: false,
          error: "Template no encontrado en Meta",
        };
      }

      return {
        success: true,
        templateId: template.id,
        status: template.status,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  }

  async deleteTemplate(
    businessId: string,
    templateName: string
  ): Promise<TemplateResult> {
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates?name=${encodeURIComponent(templateName)}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `HTTP ${res.status}`,
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  }
}

export function createMetaProvider(): MetaWhatsAppProvider | null {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return null;
  }

  return new MetaWhatsAppProvider(token, phoneNumberId);
}
