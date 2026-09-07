# Scrum Board Application

A full-stack Scrum Board application built with:
- **Frontend**: React + Vite + TypeScript
- **Backend**: Python + FastAPI
- **Database**: PostgreSQL
- **Containerization**: Docker & Docker Compose

## Prerequisites

Make sure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

## Running the Application

To start the entire application stack, simply run:

```bash
docker-compose up --build
```

This command will:
1. Start the PostgreSQL database
2. Build and start the Python backend (available at http://localhost:8000)
3. Build and start the React frontend (available at http://localhost:5173)

## Development

- **Frontend**: Navigate to the `frontend/` directory. Hot-reloading is enabled via Vite.
- **Backend**: Navigate to the `backend/` directory. Hot-reloading is enabled via Uvicorn.
- **Database**: Connect to the DB at `localhost:5432` with username `postgres`, password `postgres`, and db name `scrumboard`.

### Backend API Docs
Once the backend is running, you can access the automatic interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
