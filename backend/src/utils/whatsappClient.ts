/**
 * ============================================================================
 * FLEET FLOW — META WHATSAPP BUSINESS CLOUD API CLIENT (whatsappClient.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CLIENT?
 * --------------------
 * High-performance Meta Graph API client for dispatching WhatsApp Business
 * templates and session messages. Conforms to Meta WhatsApp Cloud API v20.0.
 * 
 * FEATURES:
 * ---------
 * - Normalizes international and Indian E.164 phone numbers (e.g. 9822001122 -> 919822001122).
 * - Formats official Highly Structured Messages (HSM) with parameter components.
 * - Authenticates via Bearer System User access token.
 * - Built-in resilient simulated fallback mode for local testing without credentials.
 * ============================================================================
 */

import crypto from 'crypto';

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  error?: string;
  isSimulated?: boolean;
}

export interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: Record<string, string | number>;
}

export interface WhatsAppTextParams {
  to: string;
  text: string;
}

/**
 * Normalizes phone numbers to Meta WhatsApp international format (digits only, no + or spaces).
 * Defaulting to India (+91) country code if a 10-digit number is provided.
 */
export function normalizeWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Builds Meta Cloud API parameter component array from key-value object
 */
export function buildTemplateComponents(parameters?: Record<string, string | number>): any[] {
  if (!parameters || Object.keys(parameters).length === 0) {
    return [];
  }

  const bodyParameters = Object.values(parameters).map((val) => ({
    type: 'text',
    text: String(val),
  }));

  return [
    {
      type: 'body',
      parameters: bodyParameters,
    },
  ];
}

/**
 * Dispatches an approved WhatsApp Business HSM Template
 */
export async function sendWhatsAppTemplate(params: WhatsAppTemplateParams): Promise<WhatsAppSendResult> {
  const { to, templateName, languageCode = 'en', parameters } = params;
  const normalizedPhone = normalizeWhatsAppPhone(to);

  if (!normalizedPhone) {
    return {
      success: false,
      messageId: '',
      error: 'Invalid recipient phone number',
    };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;

  // Real Meta Cloud API execution if credentials are present
  if (phoneNumberId && accessToken && !process.env.SIMULATE_WHATSAPP) {
    try {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const components = buildTemplateComponents(parameters);

      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();

      if (!response.ok || data.error) {
        const errorMsg = data?.error?.message || `WhatsApp API error HTTP ${response.status}`;
        console.error(`[WhatsApp API Error]: ${errorMsg}`);
        return {
          success: false,
          messageId: '',
          error: errorMsg,
        };
      }

      const messageId = data?.messages?.[0]?.id || `wamid.${crypto.randomBytes(16).toString('hex')}`;
      return {
        success: true,
        messageId,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error(`[WhatsApp Transport Error]: ${err.message}`);
      return {
        success: false,
        messageId: '',
        error: err.message,
      };
    }
  }

  // Development & Testing Simulation Fallback
  const simulatedId = `wamid.${crypto.randomBytes(16).toString('hex')}`;
  console.log(`[WhatsApp Simulated Dispatch] -> To: +${normalizedPhone} | Template: ${templateName} | ID: ${simulatedId}`);
  if (parameters) {
    console.log(`[WhatsApp Variables]:`, parameters);
  }

  return {
    success: true,
    messageId: simulatedId,
    isSimulated: true,
  };
}

/**
 * Dispatches a standard free-form WhatsApp text message (for customer support / active 24h window)
 */
export async function sendWhatsAppText(params: WhatsAppTextParams): Promise<WhatsAppSendResult> {
  const { to, text } = params;
  const normalizedPhone = normalizeWhatsAppPhone(to);

  if (!normalizedPhone) {
    return {
      success: false,
      messageId: '',
      error: 'Invalid recipient phone number',
    };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;

  if (phoneNumberId && accessToken && !process.env.SIMULATE_WHATSAPP) {
    try {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: { body: text },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      if (!response.ok || data.error) {
        return {
          success: false,
          messageId: '',
          error: data?.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.messages?.[0]?.id || `wamid.${crypto.randomBytes(16).toString('hex')}`,
        isSimulated: false,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        error: err.message,
      };
    }
  }

  const simulatedId = `wamid.${crypto.randomBytes(16).toString('hex')}`;
  console.log(`[WhatsApp Text Simulated] -> To: +${normalizedPhone} | ID: ${simulatedId}`);
  return {
    success: true,
    messageId: simulatedId,
    isSimulated: true,
  };
}
