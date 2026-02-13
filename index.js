require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

const client = new Client({ intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]});
client.buttonActions = {};
const styleMap = { primary: ButtonStyle.Primary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, secondary: ButtonStyle.Secondary };

// Express Setup
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Root -> Dashboard
app.get("/", (req,res)=>{
    res.sendFile(__dirname + "/public/dashboard.html");
});

// OAuth2 Login
app.get("/auth/discord", (req,res)=>{
    const redirectUri = encodeURIComponent(REDIRECT_URI);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`);
});

// OAuth2 Callback
app.get("/callback", async (req,res)=>{
    const code = req.query.code;
    if(!code) return res.send("Kein Code erhalten ❌");

    try{
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("client_secret", CLIENT_SECRET);
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);
        params.append("scope", "identify guilds");

        const tokenRes = await fetch("https://discord.com/api/oauth2/token",{
            method:"POST",
            body: params,
            headers: { "Content-Type":"application/x-www-form-urlencoded" }
        });
        const tokenData = await tokenRes.json();
        if(tokenData.error) return res.send("Fehler beim Token: " + tokenData.error);

        const userRes = await fetch("https://discord.com/api/users/@me",{
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();
        res.send(`Hallo ${userData.username}#${userData.discriminator}, Login erfolgreich ✅`);
    } catch(err){
        console.error(err);
        res.send("Fehler beim OAuth2 Callback ❌");
    }
});

// Channels Endpoint
app.get("/channels", async (req,res)=>{
    try{
        const guild = await client.guilds.fetch(GUILD_ID);
        const channels = await guild.channels.fetch();
        const data = Array.from(channels.values()).map(c=>({id:c.id,name:c.name,type:c.type}));
        res.json(data);
    }catch(err){ res.status(500).json([]); }
});

// Embed erstellen
app.post("/embed", async (req,res)=>{
    const { titel,beschreibung,farbe,footer,bild,feldName,feldWert,channelId } = req.body;
    try{
        const channel = await client.channels.fetch(channelId);
        const embed = new EmbedBuilder()
            .setTitle(titel)
            .setDescription(beschreibung.replace(/\\n/g,"\n"))
            .setColor(farbe || "#0099ff");
        if(footer) embed.setFooter({text:footer});
        if(bild) embed.setImage(bild);
        if(feldName && feldWert) embed.addFields({name:feldName,value:feldWert});
        await channel.send({embeds:[embed]});
        res.send("Embed erfolgreich gesendet ✅");
    }catch(err){
        console.error(err);
        res.status(500).send("Fehler beim Senden des Embeds ❌");
    }
});

// Button erstellen
app.post("/buttons", async (req,res)=>{
    const { nachrichtenid,label,style,actiontype,actionvalue,emoji } = req.body;
    try{
        const message = await client.channels.cache.first().messages.fetch(nachrichtenid);
        const row = new ActionRowBuilder();
        const button = new ButtonBuilder()
            .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
            .setLabel(label)
            .setStyle(styleMap[style] || ButtonStyle.Primary)
            .setEmoji(emoji || null);
        row.addComponents(button);
        client.buttonActions[button.data.custom_id] = { type: actiontype, value: actionvalue };
        await message.edit({components:[row]});
        res.send("Button erfolgreich hinzugefügt ✅");
    }catch(err){
        console.error(err);
        res.status(500).send("Nachricht nicht gefunden oder keine Rechte ❌");
    }
});

// Button Interaktionen
client.on("interactionCreate", async interaction=>{
    if(interaction.isButton()){
        const action = client.buttonActions[interaction.customId];
        if(!action) return;
        switch(action.type){
            case "text":
                await interaction.reply({content:action.value,ephemeral:true});
                break;
            case "role":
                const role = interaction.guild.roles.cache.get(action.value);
                if(!role) return interaction.reply({content:"Rolle nicht gefunden ❌",ephemeral:true});
                const member = interaction.member;
                if(member.roles.cache.has(role.id)) member.roles.remove(role.id);
                else member.roles.add(role.id);
                await interaction.reply({content:`Rolle ${role.name} angepasst ✅`,ephemeral:true});
                break;
            case "editembed":
                if(interaction.message.embeds.length>0){
                    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(action.value);
                    await interaction.update({embeds:[newEmbed]});
                } else await interaction.reply({content:"Keine Embed-Nachricht gefunden 😅",ephemeral:true});
                break;
            case "command":
                await interaction.reply({content:`Slash Command "${action.value}" bitte manuell ausführen`,ephemeral:true});
                break;
            default:
                await interaction.reply({content:"Unbekannte Aktion ❌",ephemeral:true});
        }
    }
});

// Start Server & Bot
const PORT = process.env.PORT || 4539;
app.listen(PORT,()=>console.log(`🌐 Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
