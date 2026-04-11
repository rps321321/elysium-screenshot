<div align="center">
  <img src="public/branding/icon_master_v2.png" alt="Elysium Logo" width="120" />
  <h1>Elysium Screenshot</h1>
  <p><b>The absolute premium, privacy-first capture tool for your browser.</b></p>
  
  [![Version](https://img.shields.io/badge/Version-1.0.0-6366f1.svg?style=for-the-badge)](https://github.com/rps321321/elysium-screenshot/releases)
  [![License](https://img.shields.io/badge/License-All_Rights_Reserved-ff4444.svg?style=for-the-badge)](LICENSE)
  [![Chrome](https://img.shields.io/badge/Platform-Chrome-white.svg?style=for-the-badge&logo=googlechrome)](https://github.com/rps321321/elysium-screenshot)
  [![Firefox](https://img.shields.io/badge/Platform-Firefox-white.svg?style=for-the-badge&logo=firefox)](https://github.com/rps321321/elysium-screenshot)

  <br />
  
  <img src="public/branding/banner_v2.png" alt="Elysium Banner">
  
  <br />

  <p>
    Elysium Screenshot is a beautifully designed, high-performance browser extension built to streamline capturing, annotating, and exporting webpages without sacrificing your privacy. Unlike typical screenshot tools, Elysium executes zero cloud processing, running completely securely within your local machine.
  </p>
</div>

<hr />

## ✨ Features

- **🌐 Full-Page Capture:** Captures entire scrolling webpages seamlessly from top to bottom.
- **🎯 Region & Element Select:** Instantly highlight exact DOM elements or drag to define custom areas.
- **🎨 Beautiful Visual Editor:** A stunning glassmorphic UI editor to annotate your captures.
- **🛠️ Pro Tools:** Add text, arrows, shapes, highlighters, and freehand drawing to your images.
- **🔒 Privacy Blur:** Instantly obscure sensitive information like emails, financials, or passwords with the smart mosaic blur tool.
- **💾 High-Fidelity Export:** Save your work in crystal-clear PNG or vector-perfect PDF without any compression artifacts.
- **🛡️ Zero Data Collection:** 100% locally executed. No analytics, no telemetry, no tracking. 

## 🚀 Installation

You can install Elysium directly from our GitHub releases!

1. Go to the [Releases page](https://github.com/rps321321/elysium-screenshot/releases).
2. Download `elysium-screenshot-1.0.0-chrome.zip` or `elysium-screenshot-1.0.0-firefox.zip`.
3. Extract the ZIP file into a folder.
4. **Chrome/Edge:** 
   - Go to `chrome://extensions`
   - Enable **Developer Mode** (top right).
   - Click **Load unpacked** and select the extracted folder.
5. **Firefox:** 
   - Go to `about:debugging#/setup`
   - Click **This Firefox** -> **Load Temporary Add-on...**
   - Select the `manifest.json` file inside the extracted folder.

## 🛠️ Tech Stack

Elysium represents the cutting edge of extension development, built on a robust web-standard architecture:

| Category | Technology | Description |
|----------|------------|-------------|
| **Core** | [WXT](https://wxt.dev/) | Next-generation extension framework for ultimate build caching. |
| **View** | [React 19](https://react.dev/) | View layer rendering for the fluid Editor UI. |
| **State** | [Zustand](https://github.com/pmndrs/zustand) | Lightweight, fast, global state-management approach. |
| **Style** | [Tailwind CSS 4](https://tailwindcss.com/) | Atomic CSS utility layer used for the glassmorphic aesthetic. |
| **Logic** | [TypeScript](https://www.typescriptlang.org/) | Strict typings across the entire background and content scripts. |

## 💻 Local Development

If you want to build Elysium from the source code locally on your machine:

```bash
# 1. Clone the repository
git clone https://github.com/rps321321/elysium-screenshot.git
cd elysium-screenshot

# 2. Install Dependencies
npm install

# 3. Start Development Server (Hot Module Reloading)
npm run dev

# 4. Build Production Bundles
npm run build
npm run zip
```

---

## 📄 License & Rights

Copyright © 2026 Raghvendra Pratap Singh. All Rights Reserved.

This software is provided free of charge for personal and non-commercial use as a browser extension. However, the exact source code distributed in this repository remains under strict proprietary copyright. You may view the source code, but you may not copy, modify, merge, publish, distribute, sublicense, or sell copies of this Software without written permission. See the [LICENSE](LICENSE) file for more information.
