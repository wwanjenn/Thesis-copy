import { useState } from 'react';
import { Box, Button, TextField, Container, Paper, Typography } from '@mui/material';

function App() {
  const [locationName, setLocationName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedImage, setDetectedImage] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const startStream = () => {
    // Use relative URL since we're serving from the same origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);
    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setDetectedImage(`data:image/jpeg;base64,${data.image}`);
    };
    setWs(newWs);
    setIsStreaming(true);
  };

  const stopStream = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
    setIsStreaming(false);
    setDetectedImage(null);
  };

  const captureFrame = () => {
    if (isStreaming && detectedImage) {
      // The image is already processed by the backend
      const link = document.createElement('a');
      link.href = detectedImage;
      link.download = 'detected_frame.jpg';
      link.click();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('location', locationName);
    formData.append('device', deviceName);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.image) {
        setDetectedImage(`data:image/jpeg;base64,${data.image}`);
      } else {
        console.error("No image received in response", data);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          COCOMAT Web Interface
        </Typography>

        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              label="Location Name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
            <TextField
              fullWidth
              label="Device Name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              color={isStreaming ? 'error' : 'primary'}
              onClick={isStreaming ? stopStream : startStream}
              fullWidth
            >
              {isStreaming ? 'Stop Camera' : 'Start Pi Camera'}
            </Button>
            <Button
              variant="contained"
              onClick={captureFrame}
              disabled={!isStreaming}
              fullWidth
            >
              Save Frame
            </Button>
            <Button
              variant="contained"
              component="label"
              fullWidth
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Button>
          </Box>

          <Box sx={{ width: '100%', height: '360px', position: 'relative' }}>
            {detectedImage ? (
              <img
                src={detectedImage}
                alt="Detection"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.200',
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  {isStreaming ? 'Waiting for camera stream...' : 'Start camera or upload an image'}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default App;