# 🚀 WhatsApp Number Checker Pro

A state-of-the-art, premium cybersecurity and mass marketing utility designed to clean, format, normalize, and check real-time WhatsApp presence for bulk contacts at scale. Built with a high-end, responsive dark-mode cyber aesthetic, distributed task workers, and support for all major WhatsApp API gateways.

Developed by **Shohan Ahmed Sham** under **Shams Code**.

---

## 🎨 Premium Key Features

* **Massive Scale Verification**: Verify up to 100K+ numbers in a single session with active API feedback.
* **Auto-Normalization & Bangladesh Filter**: Instantly formats lists to standardized international (+880) layouts.
* **Smart Duplication Removal**: Clean overlapping records and format variants instantly.
* **Supported Gateways**: Fully integrated with WaAPI, WhatsApp Cloud API, Twilio, and UltraMsg.
* **Serverless Native Worker Fallback**: Seamless async background executions powered by Celery/Redis, falling back to dynamic loop threads inside serverless (Vercel) environments.
* **Telegram Integration**: Receive real-time check completion status notifications.
* **Client Access Control Panel**: Comprehensive role management interface to activate/deactivate client accounts.
* **Fully Responsive**: Stunning design optimized for all viewports, including all Apple iPhones (SE, Pro, Pro Max).

---

## ⚡ Vercel Serverless Zero-Configuration Deployment

This repository is optimized to deploy static react clients + backend FastAPI serverless handlers as a single Vercel service with zero configurations.

1. **Deploy Repository**: Push your code to your GitHub/GitLab account.
2. **Import into Vercel**: Connect your repository to your Vercel Dashboard.
3. **Environment Setup**: Define variables like `DATABASE_URL` (SQLite file defaults automatically to safe write directory `/tmp/` in serverless), `SECRET_KEY`, and preferred gateway tokens in the Vercel project panel.
4. **Deploy**: Hit compile. Vercel automatically maps static frontend assets to `/dist` and routes dynamic API functions from `/api`.

---

## 💻 Local Development Setup

### Prerequisite Dependencies
Make sure you have **Node.js (v18+)** and **Python (v3.10+)** installed on your operating system.

### 1. Initialize Python Backend
Navigate to the `backend` directory, configure environment fields, install imports, and execute:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Initialize Static Web Client
Open a secondary terminal, navigate to the `frontend` folder, install modules, and run the developer server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to view the platform locally.

---

## 📄 License & Rights

Copyright © 2026 **Shams Code**. All Rights Reserved.  
Developed & Maintained by **Shohan Ahmed Sham**.
