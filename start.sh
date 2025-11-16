#!/bin/bash

echo "🚀 Starting ByteMail Setup..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend/.env from template..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env and set secure values for JWT_SECRET and ENCRYPTION_KEY"
    echo ""
    read -p "Press Enter to continue after editing .env file..."
fi

echo "🐳 Building Docker images..."
docker-compose build

echo ""
echo "🚀 Starting ByteMail..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ ByteMail is running!"
echo ""
echo "📧 Access ByteMail at: http://localhost:3001"
echo "👤 Default admin credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "⚠️  IMPORTANT: Change the default admin password immediately!"
echo ""
echo "📊 View logs: docker-compose logs -f"
echo "🛑 Stop ByteMail: docker-compose down"
echo ""
