import { useState } from 'react';
import { Box, Button, TextField, Container, Paper, Typography, Grid, Card, CardContent } from '@mui/material';
import { motion } from 'framer-motion'; // Animate

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

  const resetCounts = () => setMaturityCounts({ Premature: 0, Potential: 0, Mature: 0 });

  const startStream = () => {
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
  };

  const stopStream = () => {
    if (ws) ws.close();
    setWs(null);
    setIsStreaming(false);
    setDetectedImage(null);
  };

  const startCounting = async () => {
    const response = await fetch('http://127.0.0.1:8000/start-counting', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (response.ok) {
      resetCounts();
      setIsCounting(true);
    }
  };

  const stopCounting = async () => {
    const response = await fetch('http://127.0.0.1:8000/stop-counting', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (response.ok) setIsCounting(false);
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
            <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>Coconut Fruit Maturity Detection</Typography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}><TextField fullWidth label="Location" value={locationName} onChange={(e) => setLocationName(e.target.value)} sx={{ backgroundColor: 'white' }} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} sx={{ backgroundColor: 'white' }} /></Grid>
            </Grid>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}><Button fullWidth variant="contained" color={isStreaming ? 'error' : 'primary'} onClick={isStreaming ? stopStream : startStream}>{isStreaming ? 'Stop Camera' : 'Start Pi Camera'}</Button></Grid>
              <Grid item xs={6}><Button fullWidth variant="contained" color={isCounting ? 'error' : 'primary'} onClick={isCounting ? stopCounting : startCounting}>{isCounting ? 'Stop Counting' : 'Start Counting'}</Button></Grid>
            </Grid>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}><Button fullWidth variant="contained" disabled={!isStreaming} onClick={captureFrame}>Save Frame</Button></Grid>
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
        </motion.div>
      </Grid>
      <Grid item xs={12} md={4}>
        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
          <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
            <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>Maturity Counts</Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              {Object.entries(maturityCounts).map(([label, value]) => {
                let color;
                if (label === 'Premature') color = '#d0a1d6'; // Soft pinkish-purple
                if (label === 'Potential') color = '#f0c6a0'; // Soft peach
                if (label === 'Mature') color = '#a5d6a7'; // Soft green

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
        </motion.div>
      </Grid>
    </Grid>
  );

  const renderCocomadInterface = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 4, backgroundColor: '#f0f4f4' }}>
        <Typography variant="h4" textAlign="center" gutterBottom sx={{ color: '#2c3e50' }}>Coconut Tree Disease Classification</Typography>
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6}><TextField fullWidth label="Location" value={locationName} onChange={(e) => setLocationName(e.target.value)} sx={{ backgroundColor: 'white' }} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="Device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} sx={{ backgroundColor: 'white' }} /></Grid>
        </Grid>
        <Button fullWidth variant="contained" component="label" color="secondary">
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
    </motion.div>
  );

  if (!selectedInterface) {
    return (
      <Container maxWidth="md">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}>
          <Box textAlign="center" py={10}>
            <Typography variant="h3" gutterBottom sx={{ color: '#2c3e50' }}>Welcome to CocoMD v0.1</Typography>
            <Box mt={5} display="flex" justifyContent="center" gap={3}>
              <Button size="large" variant="contained" onClick={() => setSelectedInterface('COCOMAT')} color="primary">Maturity Detection</Button>
              <Button size="large" variant="contained" color="secondary" onClick={() => setSelectedInterface('COCOMAD')}>Disease Classification</Button>
            </Box>
          </Box>
        </motion.div>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Button variant="outlined" onClick={() => setSelectedInterface(null)} sx={{ mb: 3, color: '#2c3e50', borderColor: '#2c3e50' }}>
        Back
      </Button>
      {selectedInterface === 'COCOMAT' ? renderCocomatInterface() : renderCocomadInterface()}
    </Container>
  );
}

export default App;
