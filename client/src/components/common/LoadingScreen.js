import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #E91E63 0%, #FF5722 100%)',
  color: 'white',
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '2.5rem',
  marginBottom: theme.spacing(3),
  background: 'rgba(255, 255, 255, 0.9)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  fontSize: '1rem',
  opacity: 0.8,
}));

const StyledCircularProgress = styled(CircularProgress)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.8)',
}));

const LoadingScreen = ({ message = 'Loading Gymgram...' }) => {
  return (
    <LoadingContainer>
      <LogoText variant="h2" component="h1">
        💪 Gymgram
      </LogoText>
      
      <StyledCircularProgress size={50} thickness={4} />
      
      <LoadingText variant="body1">
        {message}
      </LoadingText>
    </LoadingContainer>
  );
};

export default LoadingScreen;
