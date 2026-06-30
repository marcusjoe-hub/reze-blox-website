// services/discordDm.js
// ------------------------------------------------------------
// Sends Discord DMs to users via the Discord API using a bot token.
// This service is intentionally fire-and-forget: if a DM fails, the
// quiz submission flow must still continue normally.
// ------------------------------------------------------------

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

async function createDmChannel(userId) {
  const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: userId })
  });

  if (!res.ok) {
    throw new Error(`Failed to create DM channel: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.id;
}

async function sendDmMessage(channelId, content, embed) {
  const body = { content };

  if (embed) {
    body.embeds = [embed];
  }

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Failed to send DM: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

async function sendCompletedDm(discordId, discordUsername, score, totalQuestions, robloxUsername) {
  if (!BOT_TOKEN) {
    console.warn('DISCORD_BOT_TOKEN not configured. Skipping DM.');
    return false;
  }

  try {
    const channelId = await createDmChannel(discordId);

    const embed = {
      title: '🔥 Reze Blox YT Quiz Results',
      color: 0xa855f7,
      description: `Hey <@${discordId}>! Thanks for taking the quiz.`,
      fields: [
        { name: '📊 Your Score', value: `**${score}/${totalQuestions}**`, inline: true },
        { name: '🎮 Roblox Username', value: robloxUsername || 'Not provided', inline: true },
        { name: '✅ Status', value: 'Completed', inline: true }
      ],
      footer: { text: 'Wait for results from the server team!' },
      timestamp: new Date().toISOString()
    };

    await sendDmMessage(channelId, '', embed);
    console.log(`DM sent to ${discordUsername} (${discordId}) — Score: ${score}/${totalQuestions}`);
    return true;
  } catch (error) {
    console.error(`Failed to DM ${discordUsername} (${discordId}):`, error.message);
    return false;
  }
}

async function sendCheatedDm(discordId, discordUsername) {
  if (!BOT_TOKEN) {
    console.warn('DISCORD_BOT_TOKEN not configured. Skipping DM.');
    return false;
  }

  try {
    const channelId = await createDmChannel(discordId);

    const embed = {
      title: '⚠️ Reze Blox YT Quiz Results',
      color: 0xec4899,
      description: `Hey <@${discordId}>!`,
      fields: [
        { name: '❌ Status', value: 'Caught cheating', inline: false },
        { name: '📊 Score', value: '**0/20** (LOCKED)', inline: false },
        { name: 'Reason', value: 'You switched tabs or windows during the quiz.', inline: false }
      ],
      footer: { text: 'Better luck next time.' },
      timestamp: new Date().toISOString()
    };

    await sendDmMessage(channelId, '', embed);
    console.log(`Cheat DM sent to ${discordUsername} (${discordId})`);
    return true;
  } catch (error) {
    console.error(`Failed to DM cheater ${discordUsername} (${discordId}):`, error.message);
    return false;
  }
}

module.exports = {
  sendCompletedDm,
  sendCheatedDm
};
