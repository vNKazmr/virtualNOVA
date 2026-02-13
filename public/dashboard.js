// Discord Login
document.getElementById("login-btn").addEventListener("click", () => {
  window.location.href = "/callback";
});

// Embed Formular
document.getElementById("embed-form").addEventListener("submit", async e => {
  e.preventDefault();
  const data = {
    titel: document.getElementById("titel").value,
    beschreibung: document.getElementById("beschreibung").value,
    farbe: document.getElementById("farbe").value,
    footer: document.getElementById("footer").value,
    bild: document.getElementById("bild").value,
    feldName: document.getElementById("feldname").value,
    feldWert: document.getElementById("feldwert").value
  };
  // Call your bot endpoint to send embed
  try {
    const res = await fetch("/embed", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    const result = await res.text();
    appendLog(result);
  } catch(err) { appendLog("Fehler: " + err.message); }
});

// Button Formular
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
    const result = await res.text();
    appendLog(result);
  } catch(err) { appendLog("Fehler: " + err.message); }
});

function appendLog(msg) {
  const log = document.getElementById("log");
  log.textContent += msg + "\n";
  log.scrollTop = log.scrollHeight;
}
