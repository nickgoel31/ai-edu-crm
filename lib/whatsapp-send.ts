import { readAgentSecret } from "@/lib/agent-config";
import { WhatsappProvider } from "@/types";
import { sendNotificationWhatsApp } from "@/lib/notifications";

export interface WhatsAppSendResult {
  success: boolean;
  provider: string;
  error?: string;
}

/**
 * Sends a WhatsApp text message, resolving credentials in this order:
 *
 *  1. The agent's own Meta Cloud API config (`whatsappProvider: "META_CLOUD_API"`
 *     with `metaAccessToken` + `metaPhoneNumberId` set) — sent directly via the
 *     Meta Graph API using that agent's own credentials.
 *  2. The agent's own 3rd-party BSP config (`whatsappProvider: "THIRD_PARTY_BSP"`
 *     with `bspApiEndpoint` + `bspApiKey` set) — POSTed to that BSP endpoint with
 *     a generic `{ to, message }` body and a bearer token, since BSP request
 *     shapes vary provider to provider.
 *  3. Fallback: the org-level WhatsApp `Integration` via the existing
 *     `sendNotificationWhatsApp` helper.
 *
 * Never throws — a WhatsApp delivery failure should never crash a caller such
 * as a webhook handler. Always resolves to `{ success, provider, error? }`.
 */
export async function sendWhatsAppMessage({
  organizationId,
  agentConfig,
  to,
  message,
}: {
  organizationId: string;
  agentConfig: Record<string, any>;
  to: string;
  message: string;
}): Promise<WhatsAppSendResult> {
  try {
    // 1. Agent's own Meta Cloud API credentials
    if (agentConfig?.whatsappProvider === WhatsappProvider.META_CLOUD_API) {
      const phoneNumberId = agentConfig.metaPhoneNumberId;
      const accessToken = readAgentSecret(agentConfig, "metaAccessToken");

      if (phoneNumberId && accessToken) {
        try {
          const cleanPhone = String(to).replace(/\D/g, "");
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: cleanPhone,
                type: "text",
                text: { body: message },
              }),
            }
          );

          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            return { success: true, provider: "META_CLOUD_API" };
          }
          return {
            success: false,
            provider: "META_CLOUD_API",
            error: data?.error?.message || `Meta Graph API returned ${res.status}`,
          };
        } catch (err: any) {
          return {
            success: false,
            provider: "META_CLOUD_API",
            error: err?.message || "Meta Graph API request failed.",
          };
        }
      }
    }

    // 2. Agent's own 3rd-party BSP config
    if (agentConfig?.whatsappProvider === WhatsappProvider.THIRD_PARTY_BSP) {
      const bspApiEndpoint = agentConfig.bspApiEndpoint;
      const bspApiKey = readAgentSecret(agentConfig, "bspApiKey");

      if (bspApiEndpoint && bspApiKey) {
        try {
          const res = await fetch(bspApiEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bspApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ to, message }),
          });

          const rawText = await res.text().catch(() => "");
          if (res.ok) {
            return { success: true, provider: "THIRD_PARTY_BSP" };
          }
          console.warn(
            `[WhatsApp BSP] Non-OK response (${res.status}) from ${bspApiEndpoint}: ${rawText.slice(0, 500)}`
          );
          return {
            success: false,
            provider: "THIRD_PARTY_BSP",
            error: `BSP endpoint returned ${res.status}: ${rawText.slice(0, 200)}`,
          };
        } catch (err: any) {
          return {
            success: false,
            provider: "THIRD_PARTY_BSP",
            error: err?.message || "BSP endpoint request failed.",
          };
        }
      }
    }

    // 3. Fallback: org-level WhatsApp integration
    const fallback = await sendNotificationWhatsApp({ to, message, organizationId });
    return {
      success: Boolean(fallback?.success),
      provider: fallback?.provider || "ORG_INTEGRATION_FALLBACK",
    };
  } catch (err: any) {
    return {
      success: false,
      provider: "UNKNOWN",
      error: err?.message || "Failed to send WhatsApp message.",
    };
  }
}
