export type MailEvent =
  | { event: "ack"; kind: "phd" | "supervisor"; applicationNo: string; dateOfBirth: string }
  | { event: "hall-ticket"; applicationNos: string[] }
  | { event: "selection-letter"; applicationNos: string[] }
  | { event: "recognition"; applicationNos: string[] }
  | { event: "credentials"; role: "scholar" | "supervisor"; identifier: string; password: string };

export type MailResult = { ok: boolean; sent: number; failed: number; configured: boolean };

/** Asks the server to send an event's mail. Never throws: mail must not hold up the office. */
export async function sendMailEvent(body: MailEvent): Promise<MailResult> {
  try {
    const response = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Partial<MailResult>;
    return {
      ok: Boolean(data.ok),
      sent: data.sent ?? 0,
      failed: data.failed ?? 0,
      configured: data.configured !== false,
    };
  } catch {
    return { ok: false, sent: 0, failed: 0, configured: true };
  }
}

export function mailSummary(result: MailResult, what: string) {
  if (!result.configured) return " Email is not set up yet, so no mail was sent.";
  if (result.sent > 0 && result.failed === 0) return ` ${what} emailed (${result.sent}).`;
  if (result.sent > 0)
    return ` ${what} emailed (${result.sent}); ${result.failed} could not be sent.`;
  return result.failed > 0 ? ` The ${what.toLowerCase()} email could not be sent.` : "";
}
