const btn = document.getElementById("sendBtn");
const input = document.getElementById("message");
const messages = document.getElementById("messages");

btn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  messages.innerText += "\nSen: " + text + "\n";
  input.value = "";

  const res = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: text })
  });

  const data = await res.json();

  messages.innerText += "\nAliv: " + (data.reply || data.error) + "\n";
};