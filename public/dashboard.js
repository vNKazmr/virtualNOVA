document.getElementById("login-btn").addEventListener("click", () => {
  window.location.href = "/auth/discord"; // OAuth2 Login Endpoint im Backend
});

// Channel Dropdown automatisch laden
async function loadChannels() {
  try {
    const res = await fetch("/channels");
    const channels = await res.json();
    const select = document.getElementById("channel-select");
    channels.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.type})`;
      select.appendChild(opt);
    });
  } catch(err) { appendLog("Fehler beim Laden der Channels: " + err.message); }
}
loadChannels();

document.getElementById("embed-form").addEventListener("submit", async e => {
  e.preventDefault();
  const data = {
    titel: document.getElementById("titel").value,
    beschreibung: document.getElementById("beschreibung").value,
    farbe: document.getElementById("farbe").value,
    footer: document.getElementById("footer").value,
    bild: document.getElementById("bild").value,
    feldName: document.getElementById("feldname").value,
    feldWert: document.getElementById("feldwert").value,
    channelId: document.getElementById("channel-select").value
  };
  try {
    const res = await fetch("/embed", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    appendLog(await res.text());
  } catch(err){ appendLog("Fehler: " + err.message); }
});

document.getElementById("button-form").addEventListener("submit", async e => {
  e.preventDefault();
  const data = {
    nachrichtenid: document.getElementById("nachrichtenid").value,
    label: document.getElementById("label").value,
    style: document.getElementById("style").value,
    actiontype: document.getElementById("actiontype").value,
    actionvalue: document.getElementById("actionvalue").value,
    emoji: document.getElementById("emoji").value
  };
  try {
    const res = await fetch("/buttons", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    appendLog(await res.text());
  } catch(err){ appendLog("Fehler: " + err.message); }
});

function appendLog(msg){
  const log = document.getElementById("log");
  log.textContent += msg + "\n";
  log.scrollTop = log.scrollHeight;
}
