# FinApp 💰

FinApp is a modern desktop personal finance application designed to track transactions, monitor daily balances, and manage your overall financial situation.

The application is built with a hybrid desktop architecture:
- **Desktop Shell**: [Electron](https://www.electronjs.org/)
- **Frontend**: [Angular](https://angular.dev/)
- **Backend**: Python (REST API + SQLite database)

---

## 📁 Repository Structure

```text
FinApp/
├── backend/            # Python backend (API routes, ORM models, schemas, SQLite db)
│   ├── api/            # API endpoints & controllers
│   ├── models/         # Database models
│   ├── schemas/        # Data validation & serialization schemas
│   ├── services/       # Core business logic
│   ├── app.py          # Main application entrypoint
│   ├── finapp.db       # Local SQLite database
│   └── seed.py         # Database seeding script
├── frontend-app/       # Angular Single Page Application
│   ├── src/            # Components, services, and assets
│   ├── angular.json    # Angular CLI configuration
│   └── proxy.conf.json # Dev-server proxy to backend
├── electron/           # Electron runner & packaging scripts
│   ├── main.js         # Electron main process
│   ├── preload.js      # Context bridge / IPC preload script
│   └── package.json    # Electron dependencies & scripts
├── venv/               # Python virtual environment
├── desktop.ps1         # PowerShell startup / build orchestration script
└── README.md