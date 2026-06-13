const btn = document.getElementById("sendBtn");
const input = document.getElementById("message");
const messages = document.getElementById("messages");

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = type;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

btn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  addMessage("Sen: " + text, "user");
  input.value = "";

  const thinking = addMessage("Düşünüyor...", "bot");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    thinking.innerText =
      data.reply ||
      data.error ||
      "Cevap alınamadı.";

  } catch (err) {
    thinking.innerText = "Hata: " + err.message;
  }
};

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btn.click();
  }
});
