require("dotenv").config();
const express = require("express");
const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ---------------- Express Web Server ----------------
const app = express();
app.use(express.static("public")); // serve static files

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

app.get("/callback", (req, res) => {
  res.send("Discord Login erfolgreich!");
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

// ---------------- Buttons Memory ----------------
client.buttonActions = {};
const styleMap = {
  primary: ButtonStyle.Primary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  secondary: ButtonStyle.Secondary
};

// ---------------- Slash Commands ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Erstellt einen standalone Embed")
    .addStringOption(opt => opt.setName("titel").setDescription("Titel des Embeds").setRequired(true))
    .addStringOption(opt => opt.setName("beschreibung").setDescription("Beschreibung des Embeds").setRequired(true))
    .addStringOption(opt => opt.setName("farbe").setDescription("Hex-Farbe z.B. #ff0000").setRequired(false))
    .addStringOption(opt => opt.setName("footer").setDescription("Footer Text").setRequired(false))
    .addStringOption(opt => opt.setName("bild").setDescription("Bild URL").setRequired(false))
    .addStringOption(opt => opt.setName("feldname").setDescription("Optional: Name für ein Embed-Feld").setRequired(false))
    .addStringOption(opt => opt.setName("feldwert").setDescription("Optional: Wert für das Embed-Feld").setRequired(false)),

  new SlashCommandBuilder()
    .setName("buttons")
    .setDescription("Füge einen Button zu einer Nachricht hinzu")
    .addStringOption(opt => opt.setName("nachrichtenid").setDescription("ID der Nachricht").setRequired(true))
    .addStringOption(opt => opt.setName("label").setDescription("Text des Buttons").setRequired(true))
    .addStringOption(opt => opt.setName("style").setDescription("Farbe: primary, success, danger, secondary").setRequired(true))
    .addStringOption(opt => opt.setName("actiontype").setDescription("Aktion: command, text, role, editembed").setRequired(true))
    .addStringOption(opt => opt.setName("actionvalue").setDescription("Wert der Aktion").setRequired(true))
    .addStringOption(opt => opt.setName("emoji").setDescription("Emoji des Buttons").setRequired(false))
].map(cmd => cmd.toJSON());

// ---------------- Commands registrieren ----------------
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Slash Commands registriert ✅");
  } catch (err) {
    console.error("Fehler beim Registrieren der Commands:", err);
  }
})();

// ---------------- Buttons JSON ----------------
function loadButtons() {
  try {
    if (!fs.existsSync("./buttons.json")) fs.writeFileSync("./buttons.json", "[]");
    return JSON.parse(fs.readFileSync("./buttons.json", "utf-8"));
  } catch (err) {
    console.error("Fehler beim Laden von buttons.json:", err);
    return [];
  }
}

function saveButtons(buttons) {
  try {
    fs.writeFileSync("./buttons.json", JSON.stringify(buttons, null, 2));
  } catch (err) {
    console.error("Fehler beim Speichern von buttons.json:", err);
  }
}

// ---------------- Bot ready ----------------
client.once("ready", async () => {
  console.log(`Bot online als ${client.user.tag}`);

  // ---------------- Embeds laden ----------------
  try {
    const embeds = JSON.parse(fs.readFileSync("./embed.json", "utf-8"));
    const channel = client.channels.cache.first();
    for (const e of embeds) {
      const embed = new EmbedBuilder()
        .setTitle(e.titel)
        .setDescription(e.beschreibung.replace(/\\n/g, "\n"))
        .setColor(e.farbe || "#0099ff");
      if (e.footer) embed.setFooter({ text: e.footer });
      if (e.bild) embed.setImage(e.bild);
      if (e.feldName && e.feldWert) embed.addFields({ name: e.feldName, value: e.feldWert });
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Fehler beim Einlesen von embed.json:", err);
  }

  // ---------------- Buttons laden ----------------
  const buttons = loadButtons();
  for (const b of buttons) {
    try {
      const channel = client.channels.cache.get(b.channelId);
      if (!channel) continue;
      const message = await channel.messages.fetch(b.nachrichtenId);
      const row = new ActionRowBuilder();
      const button = new ButtonBuilder()
        .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
        .setLabel(b.label)
        .setStyle(styleMap[b.style] || ButtonStyle.Primary)
        .setEmoji(b.emoji || null);
      row.addComponents(button);
      client.buttonActions[button.data.custom_id] = { type: b.actionType, value: b.actionValue };
      await message.edit({ components: [row] });
    } catch (err) {
      console.log("Button konnte nicht hinzugefügt werden:", err);
    }
  }
});

// ---------------- Interaction Handler ----------------
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "embed") {
      const titel = interaction.options.getString("titel");
      const beschreibung = interaction.options.getString("beschreibung");
      const farbe = interaction.options.getString("farbe") || "#0099ff";
      const footer = interaction.options.getString("footer") || "";
      const bild = interaction.options.getString("bild");
      const feldName = interaction.options.getString("feldname");
      const feldWert = interaction.options.getString("feldwert");

      const embed = new EmbedBuilder()
        .setTitle(titel)
        .setDescription(beschreibung.replace(/\\n/g, "\n"))
        .setColor(farbe);
      if (footer) embed.setFooter({ text: footer });
      if (bild) embed.setImage(bild);
      if (feldName && feldWert) embed.addFields({ name: feldName, value: feldWert });

      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.send({ embeds: [embed] });
      await interaction.followUp({ content: "Embed gesendet ✅", ephemeral: true });
    }

    if (interaction.commandName === "buttons") {
      const msgId = interaction.options.getString("nachrichtenid");
      const label = interaction.options.getString("label");
      const emoji = interaction.options.getString("emoji") || null;
      const style = styleMap[interaction.options.getString("style").toLowerCase()] || ButtonStyle.Primary;
      const actionType = interaction.options.getString("actiontype").toLowerCase();
      const actionValue = interaction.options.getString("actionvalue");

      try {
        const message = await interaction.channel.messages.fetch(msgId);
        const customId = `dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const button = new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(label)
          .setStyle(style)
          .setEmoji(emoji);

        const row = new ActionRowBuilder();
        if (message.components.length > 0) {
          message.components.forEach(r => r.components.forEach(c => row.addComponents(ButtonBuilder.from(c))));
        }
        row.addComponents(button);

        client.buttonActions[button.data.custom_id] = { type: actionType, value: actionValue };

        const buttons = loadButtons();
        buttons.push({
          channelId: interaction.channel.id,
          nachrichtenId: msgId,
          label,
          emoji,
          style: interaction.options.getString("style"),
          actionType,
          actionValue
        });
        saveButtons(buttons);

        await message.edit({ components: [row] });
        await interaction.reply({ content: "Button erfolgreich hinzugefügt ✅", ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: "Nachricht nicht gefunden oder keine Rechte ❌", ephemeral: true });
      }
    }
  }

  if (interaction.isButton()) {
    const action = client.buttonActions[interaction.customId];
    if (!action) return;
    switch(action.type) {
      case "text":
        await interaction.reply({ content: action.value, ephemeral: true });
        break;
      case "role":
        const role = interaction.guild.roles.cache.get(action.value);
        if (!role) return interaction.reply({ content: "Rolle nicht gefunden ❌", ephemeral: true });
        if (interaction.member.roles.cache.has(role.id)) interaction.member.roles.remove(role.id);
        else interaction.member.roles.add(role.id);
        await interaction.reply({ content: `Rolle ${role.name} angepasst ✅`, ephemeral: true });
        break;
      case "editembed":
        if (interaction.message.embeds.length > 0) {
          const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(action.value);
          await interaction.update({ embeds: [newEmbed] });
        } else {
          await interaction.reply({ content: "Keine Embed-Nachricht gefunden 😅", ephemeral: true });
        }
        break;
      case "command":
        await interaction.reply({ content: `Slash Command "${action.value}" bitte manuell ausführen`, ephemeral: true });
        break;
      default:
        await interaction.reply({ content: "Unbekannte Aktion ❌", ephemeral: true });
    }
  }
});

client.login(TOKEN);
