interface WebhookPayload {
  tokenX: string;
  tokenY: "USDC" | "SOL";
  lbPair: string;
  tokenXname: string;
  symbol: string;
}

export async function sendDiscordWebhook(payload: WebhookPayload) {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    throw new Error('DISCORD_WEBHOOK_URL is not defined in environment variables');
  }

  const embed = {
    title: `New ${payload.symbol}-${payload.tokenY} DLMM created`,
    description: `tokenX: ${payload.tokenX}`,
    fields: [
      {
        name: "tokenX",
        value: payload.tokenXname || "Unknown",
      },
      {
        name: "tokenY",
        value: payload.tokenY,
      },
    ],
    url: `https://app.meteora.ag/dlmm/${payload.lbPair}`,
    color: 3447003,
    timestamp: new Date().toISOString(),
    thumbnail: {
      url: "https://pbs.twimg.com/profile_images/1623689233813864450/XDk-DpAP_400x400.jpg",
    },
  };

  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send webhook: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook:', error);
    throw error;
  }
}
