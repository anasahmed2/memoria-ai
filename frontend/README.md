# Memoria Frontend

This is a React + Vite frontend for the Memoria AI backend.

## What It Includes

- Patient view with large quick-action buttons and simple chat
- Single patient API entrypoint via POST /chat/
- Intent-aware detail cards for routine, calendar, and location responses
- Caregiver dashboard for task CRUD via /caregiver/tasks endpoints

## Backend APIs Used

- POST /chat/
- GET /caregiver/tasks
- POST /caregiver/tasks
- PATCH /caregiver/tasks/{task_id}/complete
- DELETE /caregiver/tasks/{task_id}

## Local Setup

1. Install frontend dependencies:
	npm install

2. Configure API URL:
	copy .env.example to .env and set VITE_API_BASE_URL if needed

3. Start frontend:
	npm run dev

4. Build for production:
	npm run build

## Notes

- Default API base URL is http://127.0.0.1:8000.
- Backend CORS is currently open, so local frontend can connect directly.
