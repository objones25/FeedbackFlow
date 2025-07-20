# FeedbackFlow Setup Guide

This guide provides step-by-step instructions for setting up and running the FeedbackFlow project locally.

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/)

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/feedbackflow.git
cd feedbackflow
```

## 2. Backend Setup

### a. Install Dependencies

```bash
cd feedbackflow-backend
npm install
```

### b. Environment Variables

Create a `.env` file in the `feedbackflow-backend` directory by copying the example file:

```bash
cp .env.example .env
```

Update the `.env` file with your API keys and database credentials:

```
DATABASE_URL="postgresql://admin:password@localhost:5432/feedbackflow"
REDIS_URL="redis://localhost:6379"
HUGGINGFACE_API_KEY="your_huggingface_api_key"
NEWS_API_KEY="your_news_api_key"
```

## 3. Frontend Setup

### a. Install Dependencies

```bash
cd ../feedbackflow-frontend
npm install
```

## 4. Start the Application

Use Docker Compose to build and start all the services, including the database, Redis, backend, and frontend:

```bash
docker compose up -d --build
```

The frontend application will be accessible at `http://localhost:3000`.
The backend server will be running on `http://localhost:3001`.

## 5. Troubleshooting

### Frontend Connection Issues

If the frontend is unable to connect to the backend, you may see errors in the browser console such as `Failed to fetch`, `ECONNREFUSED`, or `ERR_NAME_NOT_RESOLVED`.

1.  **Check the Frontend `.env` file**: Ensure that `feedbackflow-frontend/.env` exists and that `NEXT_PUBLIC_API_URL` is set to `http://localhost:3001`.

2.  **Check the Backend `.env` file**: Ensure that `feedbackflow-backend/.env` exists and that `DATABASE_HOST` is set to `postgres` and `REDIS_HOST` is set to `redis`.

3.  **Check Docker Networking**: Make sure that the frontend and backend containers are on the same Docker network.

### Docker Volume Mount Error on macOS with External Drives

If you encounter an error similar to `mkdir /host_mnt/Volumes/External_Hard_Drive: file exists`, it's likely due to an issue with Docker Desktop's volume mounting on external drives.

The solution is to remove the volume mounts for the source code from the `docker-compose.yml` file. This will cause the application to run from the code copied into the image during the build process, rather than from the local file system.

**Note:** With this change, any modifications to the source code will not be reflected in the running containers until the images are rebuilt using `docker compose up -d --build`.

### Docker Credential Helper Error

If you see an error like `docker-credential-osxkeychain not found`, you may need to create a symbolic link to the executable.

### Database Initialization Issues

If the database does not initialize correctly, you can manually copy the schema file to the `postgres` container and execute it.

## 6. Project Structure

- `feedbackflow-frontend/`: Contains the Next.js frontend application.
- `feedbackflow-backend/`: Contains the Express backend server.
- `docker-compose.yml`: Defines the database and Redis services.
- `database/`: Contains database initialization scripts.

## 7. Stopping the Services

To stop the Docker containers, run:

```bash
docker-compose down
