import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 gymgram</h1>
        <p>React Application deployed via GitHub Actions</p>
        
        <div className="success-message">
          ✅ Application is running successfully!
        </div>
        
        <div className="info-section">
          <h3>System Information</h3>
          <p><strong>React Version:</strong> {React.version}</p>
          <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
          <p><strong>Build Time:</strong> {process.env.REACT_APP_BUILD_TIME || 'Not set'}</p>
          <p><strong>Current Time:</strong> {currentTime.toLocaleString()}</p>
        </div>
        
        <div className="info-section">
          <h3>Features</h3>
          <ul>
            <li>Single Page Application (SPA)</li>
            <li>Production Build Optimization</li>
            <li>Static File Serving</li>
            <li>Responsive Design</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
