require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ---------------- Memory für Buttons ----------------
client.buttonActions = {};
const styleMap = {
    primary: ButtonStyle.Primary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
    secondary: ButtonStyle.Secondary
};

// ---------------- JSON Loader ----------------
function loadEmbeds(){ if(!fs.existsSync('./embed.json')) fs.writeFileSync('./embed.json','[]'); return JSON.parse(fs.readFileSync('./embed.json','utf-8')); }
function saveEmbeds(data){ fs.writeFileSync('./embed.json',JSON.stringify(data,null,2)); }

function loadButtons(){ if(!fs.existsSync('./buttons.json')) fs.writeFileSync('./buttons.json','[]'); return JSON.parse(fs.readFileSync('./buttons.json','utf-8')); }
function saveButtons(data){ fs.writeFileSync('./buttons.json',JSON.stringify(data,null,2)); }

// ---------------- Express Setup ----------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// ---------------- Discord OAuth2 ----------------
app.get("/auth/discord",(req,res)=>{
    const redirectUri = encodeURIComponent(REDIRECT_URI);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`);
});

app.get("/callback", async (req,res)=>{
    const code = req.query.code;
    if(!code) return res.send("Kein Code erhalten ❌");

    try{
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("client_secret", CLIENT_SECRET);
        params.append("grant_type","authorization_code");
        params.append("code",code);
        params.append("redirect_uri",REDIRECT_URI);
        params.append("scope","identify guilds");

        const tokenRes = await fetch("https://discord.com/api/oauth2/token",{
            method:"POST",
            body: params,
            headers: { "Content-Type":"application/x-www-form-urlencoded" }
        });
        const tokenData = await tokenRes.json();
        if(tokenData.error) return res.send("Fehler beim Token: " + tokenData.error);

        const userRes = await fetch("https://discord.com/api/users/@me",{
            headers:{Authorization:`Bearer ${tokenData.access_token}`}
        });
        const userData = await userRes.json();

        // Redirect direkt zurück zum Dashboard mit User Info
        res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}`);
    } catch(err){
        console.error(err);
        res.send("Fehler beim OAuth2 Callback ❌");
    }
});

// ---------------- Static / Dashboard ----------------
app.use(express.static('public'));
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"public/dashboard.html"));
});

// ---------------- Channels Endpoint ----------------
app.get("/channels", async (req,res)=>{
    try{
        const guild = await client.guilds.fetch(GUILD_ID);
        const channels = await guild.channels.fetch();
        const data = Array.from(channels.values()).map(c=>({id:c.id,name:c.name,type:c.type}));
        res.json(data);
    }catch(err){ res.status(500).json([]); }
});

// ---------------- Embed Endpoint ----------------
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

        const embeds = loadEmbeds();
        embeds.push({titel,beschreibung,farbe,footer,bild,feldName,feldWert,channelId});
        saveEmbeds(embeds);

        res.send("Embed erfolgreich gesendet ✅");
    }catch(err){
        console.error(err);
        res.status(500).send("Fehler beim Senden des Embeds ❌");
    }
});

// ---------------- Buttons Endpoint ----------------
app.post("/buttons", async (req,res)=>{
    const { nachrichtenid,label,style,actiontype,actionvalue,emoji } = req.body;
    try{
        const message = await client.channels.cache.first().messages.fetch(nachrichtenid);
        const row = new ActionRowBuilder();
        const button = new ButtonBuilder()
            .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
            .setLabel(label)
            .setStyle(styleMap[style]||ButtonStyle.Primary)
            .setEmoji(emoji||null);

        row.addComponents(button);
        client.buttonActions[button.data.custom_id] = {type:actiontype,value:actionvalue};
        await message.edit({components:[row]});

        const buttons = loadButtons();
        buttons.push({nachrichtenid,label,style,actiontype,actionvalue,emoji});
        saveButtons(buttons);

        res.send("Button erfolgreich hinzugefügt ✅");
    }catch(err){
        console.error("Button konnte nicht hinzugefügt werden:", err);
        res.status(500).send("Nachricht nicht gefunden oder keine Rechte ❌");
    }
});

// ---------------- Interaction Handler ----------------
client.on("interactionCreate", async interaction=>{
    if(interaction.isButton()){
        const action = client.buttonActions[interaction.customId];
        if(!action) return;
        switch(action.type){
            case "text": await interaction.reply({content:action.value,ephemeral:true}); break;
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
            default: await interaction.reply({content:"Unbekannte Aktion ❌",ephemeral:true});
        }
    }
});

// ---------------- Load Buttons on Startup ----------------
client.once("ready", async ()=>{
    console.log(`✅ Bot online als ${client.user.tag}`);
    const buttons = loadButtons();
    for(const b of buttons){
        try{
            const channel = await client.channels.fetch(b.channelId||GUILD_ID);
            const message = await channel.messages.fetch(b.nachrichtenid);
            const row = new ActionRowBuilder();
            const button = new ButtonBuilder()
                .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
                .setLabel(b.label)
                .setStyle(styleMap[b.style]||ButtonStyle.Primary)
                .setEmoji(b.emoji||null);
            row.addComponents(button);
            client.buttonActions[button.data.custom_id] = {type:b.actiontype,value:b.actionvalue};
            await message.edit({components:[row]});
        }catch(err){
            console.log(`Nachricht ${b.nachrichtenid} im Channel ${b.channelId||GUILD_ID} nicht gefunden.`);
        }
    }
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 4539;
app.listen(PORT,()=>console.log(`🌐 Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
