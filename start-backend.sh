#!/bin/bash
# Start backend server script

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting EchoAI-Avatar Backend Server...${NC}"

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${BLUE}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install -q -r requirements.txt

# Start the server
echo -e "${GREEN}✓ Backend server starting on http://localhost:8000${NC}"
echo -e "${GREEN}✓ API documentation available at http://localhost:8000/api/docs${NC}"
echo ""
python main.py
