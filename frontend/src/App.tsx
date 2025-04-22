import { useState } from 'react';
import { Box, Button, TextField, Container, Paper, Typography } from '@mui/material';

function App() {
  const [locationName, setLocationName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [detectedImage, setDetectedImage] = useState<string | null>(null);
  const [detectedImageDisease, setDetectedImageDisease] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [diseaseResult, setDiseaseResult] = useState<string | null>(null);
  const [maturityCounts, setMaturityCounts] = useState({
    Premature: 0,
    Potential: 0,
    Mature: 0
  });
  const resetCounts = () => {
    setMaturityCounts({
      Premature: 0,
      Potential: 0,
      Mature: 0
    });
  };
  
  const startStream = () => {
    // Use relative URL since we're serving from the same origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);
    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setDetectedImage(`data:image/jpeg;base64,${data.image}`);
      if (isCounting && data.counts) {
        setMaturityCounts(prev => ({
          Premature: prev.Premature + (data.counts.Premature || 0),
          Potential: prev.Potential + (data.counts.Potential || 0),
          Mature: prev.Mature + (data.counts.Mature || 0),
        }));
        
      }
    };
    setWs(newWs);
    setIsStreaming(true);
    console.log("Counts updated:", maturityCounts);
  };

  const startCounting = async () => {
    try {
        const response = await fetch('http://127.0.0.1:8000/start-counting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.ok) {
            resetCounts();
            setIsCounting(true);

        } else {
            console.error("Failed to start counting");
            setIsCounting(false);
        }
    } catch (error) {
        console.error("Error:", error);
        setIsCounting(false);
    }
  };

  const stopCounting = async () => {
    try {
        const response = await fetch('http://127.0.0.1:8000/stop-counting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.ok) {
            setIsCounting(false);
        } else {
            console.error("Failed to stop counting");
        }
    } catch (error) {
        console.error("Error:", error);
    }
  };

  const stopStream = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
    setIsStreaming(false);
    setDetectedImage(null);
    // setDiseaseResult(null);
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
      const response = await fetch('http://127.0.0.1:8000/upload/disease', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
  
      const data = await response.json();
  
      // Set the detected image
      setDetectedImageDisease(`data:image/jpeg;base64,${data.image}`);
  
      // Check if classifications exist and retrieve the label
      if (data.classifications && Array.isArray(data.classifications) && data.classifications.length > 0) {
        const topClassification = data.classifications[0]; // Get the first classification
        setDiseaseResult(topClassification.label); // Extract and set the label
      } else {
        setDiseaseResult('No disease detected');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setDiseaseResult('Error detecting disease');
    }
  };
  
  const handleImageUploadMat = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('location', locationName);
    formData.append('device', deviceName);

    try {
      const response = await fetch('http://localhost:8000/upload/maturity', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (isCounting && data.counts) {
        setMaturityCounts(prev => ({
          Premature: prev.Premature + (data.counts.Premature || 0),
          Potential: prev.Potential + (data.counts.Potential || 0),
          Mature: prev.Mature + (data.counts.Mature || 0),
        }));
      }
      if (data.image) {
        setDetectedImage(`data:image/jpeg;base64,${data.image}`);
      } else {
        console.error("No image received in response", data);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
    console.log("Counts updated:", maturityCounts);
  };

  const renderCocomatInterface = () => (
    <Box sx={{ display: 'center', gap: 2 }}>
      <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
        <Typography variant="h5" component="h2" gutterBottom align="center">
          Coconut Fruit Maturity Detection
        </Typography>

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
            color={isCounting ? 'error' : 'primary'}
            onClick={isCounting ? stopCounting : startCounting}
            fullWidth
          >
            {isCounting ? 'Stop Counting' : 'Start Counting'}
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
              onChange={handleImageUploadMat}
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
      <Paper elevation={3} sx={{ p: 3, width: '25%' }}>
        <Typography variant="h5" component="h2" gutterBottom align="center">
          Maturity Count
        </Typography>

        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.entries(maturityCounts).map(([label, value]) => (
            <Box
              key={label}
              sx={{
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 2,
                boxShadow: 1,
                textAlign: 'center',
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                {label}
              </Typography>
              <Typography variant="h6">{value}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );

  const renderCocomadInterface = () => (
    <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Coconut Tree Disease Classification
      </Typography>
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
          component="label"
          fullWidth
        >
          Upload Coconut Image
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={handleImageUpload}
          />
        </Button>
      </Box>
  
      <Box sx={{ width: '100%', height: '360px', position: 'relative', mb: 2 }}>
        {detectedImageDisease ? (
          <img
            src={detectedImageDisease}
            alt="Coconut Disease Classification"
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
              Upload an image to classify coconut diseases.
            </Typography>
          </Box>
        )}
      </Box>
  
      {diseaseResult && (
        <Typography variant="h6" color="text.primary" align="center">
          Detected Disease: {diseaseResult}
        </Typography>
      )}
    </Paper>
  );
  

  if (!selectedInterface) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          p: 3,
        }}
      >
        <Typography variant="h4" align="center" gutterBottom>
          Welcome to CocoMD v0.1
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => setSelectedInterface('COCOMAT')}
          >
            Coconut Fruit Maturity Detection
          </Button>
          <Button
            variant="contained"
            onClick={() => setSelectedInterface('COCOMAD')}
          >
            Coconut Tree Disease Classification
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Button
          variant="outlined"
          onClick={() => setSelectedInterface(null)}
          sx={{ mb: 3 }}
        >
          Back
        </Button>
        {selectedInterface === 'COCOMAT'
          ? renderCocomatInterface()
          : renderCocomadInterface()}
      </Box>
    </Container>
  );
}

export default App;
