# FeedbackFlow

FeedbackFlow is a powerful, AI-enhanced platform for collecting, analyzing, and managing user feedback from various sources. It helps businesses and developers understand user sentiment, identify trends, and prioritize product improvements with intelligent automation.

## 🚀 Key Features

### **AI-Powered Analysis**
- **🤖 Gemini AI Integration:** Advanced structured feedback analysis with categories, themes, urgency assessment, and action items
- **📊 Multi-Dimensional Sentiment Analysis:** Beyond basic positive/negative - includes emotions, confidence scores, and context
- **🎯 Intelligent Priority Scoring:** Automatically prioritizes feedback based on urgency, category, sentiment, and business impact
- **🧠 Smart Clustering:** Groups similar feedback using both semantic embeddings and structured analysis

### **Multi-Source Data Collection**
- **📱 Reddit Integration:** Collect from hot, top, best, and new posts across multiple subreddits
- **📄 File Upload Support:** Process CSV files and bulk text documents
- **🔄 Automated Background Jobs:** Continuous monitoring and collection from configured sources
- **🚫 Intelligent Deduplication:** Prevents duplicate content using external IDs and content hashing

### **Advanced Analytics & Insights**
- **📈 Real-time Dashboard:** Interactive visualizations of sentiment trends, priority distributions, and key metrics
- **🔍 Data Explorer:** Detailed view of individual feedback items with full AI analysis
- **📋 Actionable Recommendations:** AI-generated suggested responses and action items for each piece of feedback
- **🏷️ Automatic Categorization:** Bug reports, feature requests, complaints, praise, questions, and discussions

### **Enterprise-Ready Architecture**
- **🐳 Dockerized Environment:** Easy deployment with Docker Compose
- **🔒 Secure & Scalable:** PostgreSQL database with Redis caching
- **⚡ High Performance:** Optimized clustering algorithms and efficient data processing
- **🔧 Configurable:** Flexible settings for different use cases and requirements

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Redis caching
- **AI/ML:** Google Gemini AI, Hugging Face Transformers
- **Infrastructure:** Docker, Docker Compose
- **APIs:** Reddit API, Google AI Platform

## 🎯 Use Cases

- **Product Management:** Prioritize feature requests and bug fixes based on user feedback
- **Customer Support:** Automatically categorize and route support requests
- **Community Management:** Monitor sentiment and engagement across social platforms
- **Market Research:** Analyze user opinions and trends in your industry
- **Quality Assurance:** Identify and track recurring issues and complaints

## 📊 Sample Analytics

FeedbackFlow provides rich insights including:

- **Priority Distribution:** HIGH (security issues, critical bugs) → LOW (general praise)
- **Category Breakdown:** Bug Reports (12), Questions (30), Discussions (31), etc.
- **Theme Analysis:** "security, npm, malware" vs "performance, UI, accessibility"
- **Sentiment Trends:** Track positive/negative sentiment over time
- **Action Items:** AI-generated next steps for each piece of feedback

## 🚀 Getting Started

For detailed setup instructions, please see the [SETUP.md](SETUP.md) file.

### Quick Start
```bash
# Clone the repository
git clone https://github.com/objones25/FeedbackFlow.git
cd FeedbackFlow

# Set up environment variables
cp feedbackflow-backend/.env.example feedbackflow-backend/.env
# Add your API keys (Google AI, Hugging Face)

# Start the application
docker compose up --build

# Access the dashboard
open http://localhost:3000
```

## 🔑 API Keys Required

- **Google AI API Key:** For Gemini AI structured analysis
- **Hugging Face API Key:** For sentiment analysis and embeddings
- **Reddit API:** For automated Reddit data collection (optional)

## 📈 Recent Enhancements

- ✅ **Enhanced Priority Scoring:** Multi-factor algorithm considering urgency, category, and sentiment
- ✅ **Improved Clustering:** AI-powered theme generation using structured analysis
- ✅ **Better UI/UX:** Clear priority labels (HIGH/MEDIUM/LOW) instead of confusing percentages
- ✅ **Comprehensive Reddit Collection:** Hot, top, best, and new posts from multiple subreddits
- ✅ **Advanced Deduplication:** Prevents duplicate content across all sources
- ✅ **Rich Structured Analysis:** Categories, themes, emotions, action items, and suggested responses

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines and feel free to submit issues and pull requests.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation:** [SETUP.md](SETUP.md)
- **Issues:** [GitHub Issues](https://github.com/objones25/FeedbackFlow/issues)
- **Discussions:** [GitHub Discussions](https://github.com/objones25/FeedbackFlow/discussions)
