# 🖼️ 3D Image Generation App

This project is a browser-based **3D image generator** that uses `bootstrap-llm-provider` and `OpenRouter`-compatible APIs to transform uploaded images into **realistic 3D perspectives**.  
Users can upload images, select models (Gemini, GPT, Claude, etc.), and generate multiple **viewing angles** such as front, side, top, and 45° perspective.

---

## ✨ Features

- 📤 **Upload Images** → Upload one or more source images.
- 🔮 **AI Model Selection** → Dynamically loads models via [`bootstrap-llm-provider`](https://www.npmjs.com/package/bootstrap-llm-provider).
- 🪄 **3D Image Generation** → Generate images from multiple angles with a single click.
- 🌀 **Refinement Support** → Already generated images can be refined further.
- 📸 **Image Preview & Modal** → Preview uploaded and generated images in a responsive Bootstrap modal.
- ⏳ **Loading Overlay** → Progress updates while images are being generated.
- 📥 **Download Images** → Save generated images with one click.
- 🚨 **Bootstrap Alerts** → Inline alerts for success, warning, or error feedback.

---

## 📚 Tech Stack

- ⚡ **Frontend:** HTML, JavaScript, Bootstrap 5  
- 🧩 **Libraries:**  
  - [`bootstrap-llm-provider`](https://www.npmjs.com/package/bootstrap-llm-provider) → For API config & model management  
  - [`bootstrap-alert`](https://www.npmjs.com/package/bootstrap-alert) → For styled alerts  
- 🤖 **AI Backends:** OpenRouter-compatible APIs (`gemini`, `gpt-4`, `claude`)  

---

## 🔧 Setup & Usage

### 1. Clone this repo
```bash
git clone https://github.com/Nitin399-maker/3dimagegen.git
cd 3dimagegen
