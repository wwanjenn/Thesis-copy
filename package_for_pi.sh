#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Packaging COCOMAT for Raspberry Pi deployment...${NC}"

# Create a clean build directory
echo "Creating build directory..."
rm -rf build
mkdir -p build/cocomat

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Copy necessary files
echo "Copying files..."
cp -r backend build/cocomat/
cp -r frontend/dist build/cocomat/frontend/
cp best5.pt build/cocomat/
cp requirements.txt build/cocomat/
cp start_server.sh build/cocomat/
cp -r venv build/cocomat/

# Create installation script
cat > build/cocomat/install.sh << 'EOF'
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Installing COCOMAT...${NC}"

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo; then
    echo -e "${RED}Error: This script must be run on a Raspberry Pi${NC}"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version)
if [[ $PYTHON_VERSION != *"3.11"* ]]; then
    echo -e "${RED}Error: Python 3.11 is required${NC}"
    echo "Please install Python 3.11 using:"
    echo "sudo apt update"
    echo "sudo apt install python3.11 python3.11-venv"
    exit 1
fi

# Install system dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    python3-picamera2 \
    python3.11-pip \
    python3.11-venv \
    libopencv-dev

# Verify Python dependencies are compatible
echo "Verifying Python environment..."
source venv/bin/activate
python3.11 -m pip check

# Enable camera if not already enabled
if ! grep -q "^start_x=1" /boot/config.txt; then
    echo "Enabling camera module..."
    sudo raspi-config nonint do_camera 0
fi

# Make start script executable
chmod +x start_server.sh

# Update start script to use virtual environment
sed -i '2i# Activate virtual environment\nsource venv/bin/activate' start_server.sh

echo -e "${GREEN}Installation complete!${NC}"
echo "You can now run COCOMAT using: ./start_server.sh"
EOF

# Make installation script executable
chmod +x build/cocomat/install.sh

# Create archive
echo "Creating archive..."
cd build
tar czf cocomat.tar.gz cocomat/
cd ..

echo -e "${GREEN}Package created successfully!${NC}"
echo "The package is available at: build/cocomat.tar.gz"
echo ""
echo "To deploy on Raspberry Pi:"
echo "1. Copy cocomat.tar.gz to the Raspberry Pi"
echo "2. On the Pi, run:"
echo "   tar xzf cocomat.tar.gz"
echo "   cd cocomat"
echo "   ./install.sh"