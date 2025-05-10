import { useState } from 'react';
import {
  Box, Button, TextField, Container, Paper, Typography,
  Grid, Card, CardContent, CircularProgress
} from '@mui/material';
import backgroundImage from './WELCOME.png'; // Make sure WELCOME.png is in the same folder
import cocoLogo from './COCO.png';

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
    Mature: 0,
  });
  const [loading, setLoading] = useState(false);

  const resetCounts = () => setMaturityCounts({ Premature: 0, Potential: 0, Mature: 0 });

  const startStream = () => {
    setLoading(true);
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
    setLoading(false);
  };

  const stopStream = () => {
    if (ws) ws.close();
    setWs(null);
    setIsStreaming(false);
    setDetectedImage(null);
  };

  const startCounting = async () => {
    setLoading(true);
    const response = await fetch('http://127.0.0.1:8000/start-counting', { method: 'POST' });
    if (response.ok) {
      resetCounts();
      setIsCounting(true);
    }
    setLoading(false);
  };

  const stopCounting = async () => {
    setLoading(true);
    const response = await fetch('http://127.0.0.1:8000/stop-counting', { method: 'POST' });
    if (response.ok) setIsCounting(false);
    setLoading(false);
  };

  const captureFrame = () => {
    if (isStreaming && detectedImage) {
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

    const response = await fetch('http://127.0.0.1:8000/upload/disease', { method: 'POST', body: formData });
    const data = await response.json();

    setDetectedImageDisease(`data:image/jpeg;base64,${data.image}`);
    setDiseaseResult(data.classifications?.[0]?.label ?? 'No disease detected');
  };

  const handleImageUploadMat = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('location', locationName);
    formData.append('device', deviceName);

    const response = await fetch('http://localhost:8000/upload/maturity', { method: 'POST', body: formData });
    const data = await response.json();

    if (isCounting && data.counts) {
      setMaturityCounts(prev => ({
        Premature: prev.Premature + (data.counts.Premature || 0),
        Potential: prev.Potential + (data.counts.Potential || 0),
        Mature: prev.Mature + (data.counts.Mature || 0),
      }));
    }
    if (data.image) setDetectedImage(`data:image/jpeg;base64,${data.image}`);
  };

  const renderCocomatInterface = () => (
    <Grid container spacing={4}>
      <Grid item xs={12} md={8}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
          <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>
            Coconut Fruit Maturity Detection
          </Typography>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={6}>
              <TextField fullWidth label="Location" value={locationName} onChange={(e) => setLocationName(e.target.value)} sx={{ backgroundColor: 'white' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} sx={{ backgroundColor: 'white' }} />
            </Grid>
          </Grid>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" color={isStreaming ? 'error' : 'primary'} onClick={isStreaming ? stopStream : startStream} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : isStreaming ? 'Stop Camera' : 'Start Pi Camera'}
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" color={isCounting ? 'error' : 'primary'} onClick={isCounting ? stopCounting : startCounting} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : isCounting ? 'Stop Counting' : 'Start Counting'}
              </Button>
            </Grid>
          </Grid>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" disabled={!isStreaming} onClick={captureFrame}>Save Frame</Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" component="label" color="secondary">
                Upload Image
                <input hidden type="file" accept="image/*" onChange={handleImageUploadMat} />
              </Button>
            </Grid>
          </Grid>
          <Box sx={{ width: '100%', height: 360, borderRadius: 2, overflow: 'hidden', bgcolor: '#e9f1f1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {detectedImage
              ? <img src={detectedImage} alt="Detection" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Typography variant="h6" color="text.secondary">{isStreaming ? 'Streaming...' : 'Upload or Start Camera'}</Typography>
            }
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
          <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>Maturity Counts</Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            {Object.entries(maturityCounts).map(([label, value]) => {
              let color;
              if (label === 'Premature') color = '#d0a1d6';
              if (label === 'Potential') color = '#f0c6a0';
              if (label === 'Mature') color = '#a5d6a7';

              return (
                <Card key={label} variant="outlined" sx={{ bgcolor: '#fafafa', textAlign: 'center' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold">{label}</Typography>
                    <Typography variant="h5" style={{ color }}>{value}</Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderCocomadInterface = () => (
    <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
      <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>Coconut Tree Disease Classification</Typography>
      <Grid container spacing={2} mb={2}>
        <Grid item xs={6}>
          <TextField fullWidth label="Location" value={locationName} onChange={(e) => setLocationName(e.target.value)} sx={{ backgroundColor: 'white' }} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} sx={{ backgroundColor: 'white' }} />
        </Grid>
      </Grid>
      <Button fullWidth variant="contained" component="label" color="secondary" disabled={loading}>
        Upload Coconut Image
        <input hidden type="file" accept="image/*" onChange={handleImageUpload} />
      </Button>
      <Box mt={3} sx={{ width: '100%', height: 360, borderRadius: 2, overflow: 'hidden', bgcolor: '#e9f1f1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {detectedImageDisease
          ? <img src={detectedImageDisease} alt="Disease Detection" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Typography variant="h6" color="text.secondary">Upload to classify disease</Typography>
        }
      </Box>
      {diseaseResult && (
        <Typography mt={3} variant="h5" color="primary" textAlign="center">
          {diseaseResult}
        </Typography>
      )}
    </Paper>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      {!selectedInterface ? (
        <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box textAlign="center">
            <img 
  src={cocoLogo} 
  alt="CocoMD Logo" 
  style={{ 
    width: '100%', 
    maxWidth: '600px', 
    display: 'block', 
    marginBottom: '1rem',
    filter: 'drop-shadow(1px 1px 4px rgba(0,0,0,0.6))' 
  }} 
/>

            <Box mt={5} display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={3}>
              <Button size="large" variant="contained" onClick={() => setSelectedInterface('COCOMAT')} color="primary">
                Maturity Detection
              </Button>
              <Button size="large" variant="contained" color="secondary" onClick={() => setSelectedInterface('COCOMAD')}>
                Disease Classification
              </Button>
            </Box>
          </Box>
        </Container>
      ) : (
        <Container maxWidth="xl" sx={{ py: 4 }}>
<Button 
  variant="outlined" 
  onClick={() => setSelectedInterface(null)} 
  sx={{ 
    mb: 3, 
    color: '#fff', // Text color
    borderColor: '#007bff', // Blue border color
    backgroundColor: '#007bff', // Blue background color
    '&:hover': {
      backgroundColor: '#0056b3', // Darker blue when hovered
      borderColor: '#0056b3', // Darker border on hover
    }
  }}
>
  Back
</Button>

          {selectedInterface === 'COCOMAT' ? renderCocomatInterface() : renderCocomadInterface()}
        </Container>
      )}
    </Box>
  );
}

export default App;
