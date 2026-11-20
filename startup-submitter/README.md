# 🚀 Automated Startup Backlink Submitter

Automated directory registration and backlink submission engine powered by **CloakBrowser & Playwright Stealth Contexts**.

Based on the curated directory list from [`mmccaff/PlacesToPostYourStartup`](https://github.com/mmccaff/PlacesToPostYourStartup), this tool automatically navigates, fills out submission forms, bypasses SPA event traps, and submits your startup to 80+ high-DA platforms without manual human intervention.

---

## 📁 Project Structure

```
startup-submitter/
├── config/
│   ├── startupProfile.json          # Your active startup & founder details
│   └── startupProfile.example.json  # Reference configuration schema
├── data/
│   └── directories.json             # 101 parsed websites & directories
├── src/
│   ├── core/
│   │   ├── types.ts                 # TypeScript types
│   │   ├── stealthBrowser.ts        # CloakBrowser persistent context manager
│   │   └── formFiller.ts            # Smart DOM heuristic field-matcher & event dispatcher
│   ├── adapters/
│   │   └── genericAdapter.ts        # Automated navigation, cookie bypass & submission
│   └── runner.ts                    # Master CLI batch submitter
├── proofs/                          # Automated submission screenshot receipts
└── output/                          # Exported submission ledgers (.csv & .json)
```

---

## ⚙️ Configuration

Edit `startup-submitter/config/startupProfile.json` with your startup's details:

```json
{
  "startup": {
    "name": "My Tool Name",
    "url": "https://mytool.com",
    "tagline": "One-line punchy description",
    "descriptionShort": "1-2 sentence pitch",
    "descriptionLong": "Full comprehensive overview...",
    "category": "SaaS / AI / Developer Tools",
    "pricingModel": "Freemium",
    "tags": ["seo", "marketing", "automation", "growth"],
    "twitterUrl": "https://x.com/mytool"
  },
  "founder": {
    "name": "Nitin",
    "email": "nitin@example.com"
  },
  "assets": {
    "logoPath": "C:/path/to/logo.png",
    "screenshotPath": "C:/path/to/screenshot.png"
  }
}
```

---

## 🚀 Usage

### 1. Test Single Directory Submission:
Target a specific high-authority directory (e.g. Launching Next):
```bash
npm run submit -- --site launching-next
```

### 2. Run Direct-Submission Sites in Batch:
Submit only to platforms that accept direct form submissions (no account creation required):
```bash
npm run submit -- --type direct-form --limit 5
```

### 3. Run Full Batch in Headless Mode:
```bash
npm run submit -- --headless
```

---

## 🛡️ Anti-Detection & Smart Automation Features

1. **Persistent Browser Profiles:** Keeps cookies, session tokens, and local cache saved on disk between runs.
2. **React Fiber / Vue State Synchronization:** Uses native prototype descriptor setters (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set`) so modern SPA controlled components sync automatically.
3. **Automated Proof Screenshots:** Every completed submission saves a visual screenshot proof in `proofs/<directory>_<timestamp>.png`.
4. **Pacing & Cooldowns:** Enforces a 4-second delay between platforms to prevent IP burn and stay under edge rate limits.

