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

## 4. Start the Services

Use Docker Compose to start the PostgreSQL database and Redis instance:

```bash
docker-compose up -d
```

## 5. Run the Application

### a. Start the Backend Server

In the `feedbackflow-backend` directory:

```bash
npm run dev
```

The backend server will be running on `http://localhost:3001`.

### b. Start the Frontend Development Server

In the `feedbackflow-frontend` directory:

```bash
npm run dev
```

The frontend application will be accessible at `http://localhost:3000`.

## 6. Project Structure

- `feedbackflow-frontend/`: Contains the Next.js frontend application.
- `feedbackflow-backend/`: Contains the Express backend server.
- `docker-compose.yml`: Defines the database and Redis services.
- `database/`: Contains database initialization scripts.

## 7. Stopping the Services

To stop the Docker containers, run:

```bash
docker-compose down
