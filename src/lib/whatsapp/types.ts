export interface TemplateBodyOrHeader {
  type: "body" | "header";
  parameters: { type: "text"; text: string }[];
}

export interface TemplateButtonComponent {
  type: "button";
  sub_type: "url" | "copy_code" | "quick_reply";
  index: string;
  parameters: { type: "text"; text: string }[];
}

export type TemplateComponent = TemplateBodyOrHeader | TemplateButtonComponent;

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components: TemplateComponent[]
  ): Promise<SendResult>;

  sendText(to: string, text: string): Promise<SendResult>;
}
