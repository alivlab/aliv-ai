const btn = document.getElementById("sendBtn");
const input = document.getElementById("message");
const messages = document.getElementById("messages");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

let selectedFile = null;

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
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

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

btn.onclick = async () => {
  const text = input.value.trim();

  if (!text && !selectedFile) return;

  addMessage(text || "Dosya gönderildi.", "user");

  const thinking = addMessage("Düşünüyor...", "bot");

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
        file: fileData
      })
    });

    const data = await res.json();

    thinking.innerText =
      data.reply ||
      data.error ||
      "Cevap alınamadı.";

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
