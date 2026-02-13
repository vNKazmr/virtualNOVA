async function request(url, data = null) {
  return fetch(url, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : null
  }).then(res => res.json());
}

async function loadStatus() {
  const data = await request("/api/status");
  document.getElementById("status").textContent =
    "Bot: " + data.bot +
    "\nServer: " + data.servers +
    "\nUptime: " + Math.floor(data.uptime) + " Sekunden";
}

async function sendEmbed() {
  await request("/api/embed", {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    color: document.getElementById("color").value
  });
  alert("Embed gesendet");
}

async function sendButton() {
  await request("/api/button", {
    label: document.getElementById("label").value,
    style: document.getElementById("style").value
  });
  alert("Button gesendet");
}
