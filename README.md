# Doorman v2 - Premium Real Estate Platform

![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![CapRover](https://img.shields.io/badge/CapRover-004152?style=for-the-badge&logo=caprover&logoColor=white)

Doorman v2 is a state-of-the-art, high-fidelity real estate and property management platform. Designed with a premium aesthetic, it features a seamless user experience, powerful search capabilities, and a comprehensive administration suite.

## ✨ Key Features

- **💎 Premium UI/UX**: Modern glassmorphism-inspired design with smooth transitions and responsive layouts.
- **🏠 Property Listings**: advanced search and filtering system for properties (location, price, rooms, listing type).
- **📝 Content Management**: A robust Admin Dashboard to manage properties, blog posts, and leads.
- **🌍 Multilingual**: Full internationalization support (i18n) for global reach.
- **📰 Integrated Blog**: Professional industry insights with SEO-optimized detail pages.
- **📮 Inquiry Management**: Integrated contact system for direct property inquiries.

## 🛠 Tech Stack

- **Frontend Core**: [Vue 3](https://vuejs.org/) (Composition API / `<script setup>`)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Routing**: Vue Router 4
- **State/i18n**: Vue i18n
- **Editor**: Vue Quill for rich-text content
- **Deployment**: Docker, CapRover, GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and update the variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to point to your backend API.*

4. **Run development server**:
   ```bash
   npm run dev
   ```

## 📦 Deployment

### Docker
The project includes a multi-stage `Dockerfile` for production-ready builds served via Nginx.

```bash
docker build -t doorman-frontend .
```

### Automatic CI/CD
This project is configured with **GitHub Actions** for seamless delivery:
1. Every push to `main` triggers a build.
2. An image is automatically pushed to Docker Hub with unique version tags.
3. The new version is automatically deployed to the **CapRover** server.

*Ensure required secrets (`DOCKERHUB_TOKEN`, `CAPROVER_SERVER`, etc.) are configured in GitHub.*

## 📁 Project Structure

```text
src/
├── components/   # Reusable UI components (Hero, Navbar, etc.)
├── views/        # Page-level components (Admin, PropertyDetail, etc.)
├── services/     # API service layers
├── router/       # Navigation logic
├── i18n/         # Multi-language translations
└── assets/       # Global styles and static files
```

## 📄 License

This project is owned and operated by **Doorman SAS**. All rights reserved. See the [LICENSE](LICENSE) file for more details.
