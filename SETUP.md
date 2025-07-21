# FeedbackFlow Setup Guide

This guide provides step-by-step instructions for setting up and running the FeedbackFlow project with all AI-enhanced features using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/)

## 1. Clone the Repository

```bash
git clone https://github.com/objones25/FeedbackFlow.git
cd FeedbackFlow
```

## 2. Environment Configuration

### Backend Environment Variables

Create a `.env` file in the `feedbackflow-backend` directory:

```bash
cp feedbackflow-backend/.env.example feedbackflow-backend/.env
```

Update the `.env` file with your API keys:

```env
# Database Configuration (Docker defaults)
DATABASE_URL="postgresql://admin:password@postgres:5432/feedbackflow"
DATABASE_HOST="postgres"
DATABASE_PORT="5432"
DATABASE_NAME="feedbackflow"
DATABASE_USER="admin"
DATABASE_PASSWORD="password"

# Redis Configuration (Docker defaults)
REDIS_URL="redis://redis:6379"
REDIS_HOST="redis"
REDIS_PORT="6379"

# AI/ML API Keys (Required for enhanced features)
GOOGLE_API_KEY="your_google_gemini_api_key"
HUGGINGFACE_API_KEY="your_huggingface_api_key"

# Optional API Keys
NEWS_API_KEY="your_news_api_key"
REDDIT_CLIENT_ID="your_reddit_client_id"
REDDIT_CLIENT_SECRET="your_reddit_client_secret"
REDDIT_USER_AGENT="FeedbackFlow/1.0"

# Server Configuration
PORT="3001"
NODE_ENV="production"
```

### Frontend Environment Variables

Create a `.env` file in the `feedbackflow-frontend` directory:

```bash
cp feedbackflow-frontend/.env.example feedbackflow-frontend/.env
```

Update with:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 3. API Key Setup

### **Google Gemini AI (Required for Enhanced Analysis)**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to `feedbackflow-backend/.env` as `GOOGLE_API_KEY`

### **Hugging Face (Required for Sentiment Analysis)**
1. Sign up at [Hugging Face](https://huggingface.co/)
2. Go to Settings → Access Tokens
3. Create a new token with read permissions
4. Add it to `feedbackflow-backend/.env` as `HUGGINGFACE_API_KEY`

### **Reddit API (Optional - for automated collection)**
1. Go to [Reddit Apps](https://www.reddit.com/prefs/apps)
2. Create a new application (script type)
3. Add the client ID and secret to your `.env` file

## 4. Start the Application

Use Docker Compose to build and start all services:

```bash
# Build and start all containers
docker compose up -d --build
```

This will start:
- **PostgreSQL Database** (port 5432)
- **Redis Cache** (port 6379)
- **Backend API** (port 3001)
- **Frontend Dashboard** (port 3000)

### Service URLs
- **Frontend Dashboard:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001`

## 5. Verify Installation

Check that all containers are running:

```bash
docker compose ps
```

You should see all services as "Up" and healthy.

## 6. Initialize Database (Automatic)

The database will automatically initialize with the required schema. You can verify by checking the tables:

```bash
# Connect to the database
docker exec -it feedbackflow-postgres psql -U admin -d feedbackflow

# List tables
\dt

# Exit
\q
```

## 7. Using FeedbackFlow

### Dashboard Features
- **📊 Analytics Dashboard:** `http://localhost:3000/dashboard`
- **🔍 Data Explorer:** `http://localhost:3000/data`
- **⚙️ Settings:** `http://localhost:3000/settings`
- **📋 Jobs:** `http://localhost:3000/jobs`

### Processing Feedback

#### **Enhanced Reddit Analysis**
```bash
# Process Reddit posts with Gemini AI analysis
curl -X POST http://localhost:3001/api/feedback/process/reddit-enhanced \
  -H "Content-Type: application/json" \
  -d '{"subreddit": "javascript", "options": {"batchSize": 10, "useGeminiAnalysis": true}}'
```

#### **File Upload Processing**
- Navigate to `http://localhost:3000/settings`
- Upload CSV files or text documents
- View processed results in the Data Explorer

### Key API Endpoints

- `GET /api/feedback/dashboard` - Dashboard analytics
- `GET /api/feedback/groups` - Feedback groups with clustering
- `GET /api/groups/:id/sentences` - Detailed group analysis
- `POST /api/feedback/process/reddit-enhanced` - Enhanced Reddit processing

## 8. Container Management

### View Logs
```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

### Restart Services
```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

## 9. Advanced Configuration

### Background Jobs
FeedbackFlow includes automated background jobs for continuous data collection:

- **Reddit Monitoring:** Automatically collect from hot, top, best, and new posts
- **Sentiment Analysis:** Process new feedback with AI analysis
- **Clustering Updates:** Refresh groupings as new data arrives

### Priority Scoring Algorithm
- **Urgency (40%):** critical > high > medium > low
- **Category (30%):** bug_report > complaint > feature_request > question > discussion > praise
- **Sentiment (20%):** negative sentiment increases priority
- **Action Items (10%):** more action items = higher priority

## 10. Troubleshooting

### Common Issues

#### **Containers Not Starting**
```bash
# Check container status
docker compose ps

# View error logs
docker compose logs

# Rebuild containers
docker compose down
docker compose up -d --build
```

#### **Frontend Can't Connect to Backend**
1. Verify `NEXT_PUBLIC_API_URL="http://localhost:3001"` in frontend `.env`
2. Check backend container is running: `docker compose ps`
3. Test backend directly: `curl http://localhost:3001/api/feedback/dashboard`

#### **AI Analysis Not Working**
1. Verify `GOOGLE_API_KEY` is set in `feedbackflow-backend/.env`
2. Check API key permissions and quotas
3. Review backend logs: `docker compose logs backend`

#### **Database Connection Issues**
1. Ensure PostgreSQL container is healthy: `docker compose ps`
2. Check database logs: `docker compose logs postgres`
3. Verify database credentials match between `.env` and `docker-compose.yml`

#### **Docker Volume Mount Error on macOS**
If you encounter volume mount errors on external drives, the containers will run from the built image code instead of mounted volumes. Code changes will require rebuilding:

```bash
docker compose up -d --build
```

### Performance Optimization

#### **For Large Datasets**
- Increase `batchSize` in processing options (default: 10)
- Use `maxSentences` to limit processing scope
- Monitor container resources: `docker stats`

#### **API Rate Limits**
- Google Gemini: 60 requests per minute (free tier)
- Hugging Face: 1000 requests per hour (free tier)
- Adjust batch sizes if hitting rate limits

## 11. Database Management

### Backup Database
```bash
# Create backup
docker exec feedbackflow-postgres pg_dump -U admin feedbackflow > backup.sql
```

### Restore Database
```bash
# Restore from backup
docker exec -i feedbackflow-postgres psql -U admin -d feedbackflow < backup.sql
```

### Reset Database
```bash
# Stop containers and remove volumes
docker compose down -v

# Restart (will recreate database)
docker compose up -d --build
```

## 12. Stopping the Services

```bash
# Stop all containers
docker compose down

# Stop and remove volumes (clears database)
docker compose down -v

# Remove images
docker compose down --rmi all
```

## 13. Project Structure

```
FeedbackFlow/
├── feedbackflow-frontend/          # Next.js frontend (Dockerized)
│   ├── src/app/                   # App router pages
│   ├── src/components/            # React components
│   ├── Dockerfile                 # Frontend container config
│   └── .env                       # Frontend environment variables
├── feedbackflow-backend/           # Express backend (Dockerized)
│   ├── src/services/              # Business logic services
│   ├── src/routes/                # API route handlers
│   ├── database/init/             # Database schema files
│   ├── Dockerfile                 # Backend container config
│   └── .env                       # Backend environment variables
├── docker-compose.yml             # All services configuration
├── README.md                      # Project overview
└── SETUP.md                       # This setup guide
```

## 14. Next Steps

After setup, explore these features:
1. **Visit Dashboard:** `http://localhost:3000/dashboard`
2. **Process Reddit Data:** Use the enhanced Reddit processing
3. **Upload Files:** Try the file upload feature in Settings
4. **Explore Analytics:** View the data explorer with AI insights
5. **Monitor Jobs:** Check background processing status

## 15. Production Deployment

For production deployment:
1. Update environment variables for production
2. Use proper secrets management
3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Configure database backups
6. Monitor container health

For questions or issues, please check the [GitHub Issues](https://github.com/objones25/FeedbackFlow/issues) page.
