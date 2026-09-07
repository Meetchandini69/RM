export async function sendTelegramInterest(input: {
  profileName: string;
  profileSlug: string;
  contactType: "telegram" | "whatsapp";
  contact: string;
  note?: string;
}) {
  return sendAdminTelegram(
    [
      "New introduction — Him For You",
      `Profile: ${input.profileName} (${input.profileSlug})`,
      `Reply via ${input.contactType === "telegram" ? "Telegram" : "WhatsApp"}: ${input.contact}`,
      "",
      `Message: ${input.note || "(No note provided)"}`,
    ].join("\n"),
  );
}

export async function sendAdminTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) throw new Error("TELEGRAM_NOT_CONFIGURED");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );
  const result = (await response.json()) as { ok?: boolean };
  if (!response.ok || result.ok !== true)
    throw new Error("TELEGRAM_DELIVERY_FAILED");
}
