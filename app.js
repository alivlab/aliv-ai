const btn = document.getElementById("sendBtn");
const input = document.getElementById("message");
const messages = document.getElementById("messages");

btn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  messages.innerText += "\nSen: " + text + "\n";
  messages.innerText += "\nAliv düşünüyor...\n";
  input.value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    messages.innerText +=
      "\nDEBUG:\n" + JSON.stringify(data, null, 2) + "\n";

  } catch (err) {
    messages.innerText += "\nHata: " + err.message + "\n";
  }
};
