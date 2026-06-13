const btn = document.getElementById("sendBtn");
const input = document.getElementById("message");
const messages = document.getElementById("messages");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

let selectedFile = null;
let history = [];

function removeEmpty() {
  const empty = document.querySelector(".empty");
  if (empty) empty.remove();
}

function addMessage(text, type) {
  removeEmpty();

  const row = document.createElement("div");
  row.className = `msg ${type}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerText = type === "user" ? "S" : "A";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messages.appendChild(row);

  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function newChat() {
  history = [];
  selectedFile = null;
  fileInput.value = "";
  filePreview.classList.remove("active");
  messages.innerHTML = `
    <div class="empty">
      <img src="/cover.jpg" alt="Aliv" />
      <h2>Bugün ne üretelim?</h2>
      <p>Bir görsel yükle, fikir anlat veya doğrudan yaz.</p>
    </div>
  `;
}

fileBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
  selectedFile = fileInput.files[0];

  if (selectedFile) {
    filePreview.classList.add("active");
    filePreview.innerText = `Eklenen dosya: ${selectedFile.name}`;
  }
};

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result.split(",")[1]);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

btn.onclick = async () => {
  const text = input.value.trim();

  if (!text && !selectedFile) return;

  addMessage(text || "Dosya gönderildi.", "user");

  const thinking = addMessage("Düşünüyorum...", "bot");

  input.value = "";
  input.style.height = "auto";

  try {
    let fileData = null;

    if (selectedFile) {
      fileData = {
        name: selectedFile.name,
        type: selectedFile.type,
        data: await fileToBase64(selectedFile)
      };
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        file: fileData,
        history
      })
    });

    const data = await res.json();

    const reply = data.reply || data.error || "Cevap alınamadı.";
    thinking.innerText = reply;

    history.push({
      role: "user",
      text: text || `[Dosya: ${selectedFile?.name}]`
    });

    history.push({
      role: "model",
      text: reply
    });

  } catch (err) {
    thinking.innerText = "Hata: " + err.message;
  }

  selectedFile = null;
  fileInput.value = "";
  filePreview.classList.remove("active");
  filePreview.innerText = "";
};

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btn.click();
  }
});
