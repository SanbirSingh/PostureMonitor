import React, { useRef, useEffect, useState } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const intervalRef = useRef(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [postureStatus, setPostureStatus] = useState('neutral');
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    let scriptsLoaded = 0;
    const requiredScripts = 2;

    const checkInitialization = () => {
      scriptsLoaded++;
      if (scriptsLoaded === requiredScripts) {
        initializePoseDetection();
      }
    };

    // Load MediaPipe scripts
    const scriptPose = document.createElement('script');
    scriptPose.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    scriptPose.onload = checkInitialization;
    document.body.appendChild(scriptPose);

    const scriptCamera = document.createElement('script');
    scriptCamera.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    scriptCamera.onload = checkInitialization;
    document.body.appendChild(scriptCamera);

    const initializePoseDetection = () => {
      poseRef.current = new window.Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      poseRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
      });

      poseRef.current.onResults((results) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw camera feed
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        
        // Draw pose landmarks if detected
        if (results.poseLandmarks) {
          drawLandmarks(ctx, results.poseLandmarks);
          
          const leftShoulder = results.poseLandmarks[11];
          const rightShoulder = results.poseLandmarks[12];
          
          if (leftShoulder.y > 0.7 || rightShoulder.y > 0.7) {
            setPostureStatus('bad');
            showPostureAlert();
          } else {
            setPostureStatus('good');
          }
        }
        ctx.restore();
      });

      // Initialize camera
      if (videoRef.current) {
        cameraRef.current = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await poseRef.current.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
      }
    };

    const drawLandmarks = (ctx, landmarks) => {
      ctx.fillStyle = '#00FF00';
      landmarks.forEach(landmark => {
        const x = landmark.x * canvasRef.current.width;
        const y = landmark.y * canvasRef.current.height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw connections between landmarks
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      
      // Shoulder line
      ctx.beginPath();
      ctx.moveTo(landmarks[11].x * canvasRef.current.width, landmarks[11].y * canvasRef.current.height);
      ctx.lineTo(landmarks[12].x * canvasRef.current.width, landmarks[12].y * canvasRef.current.height);
      ctx.stroke();
    };

    const showPostureAlert = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ Sit up straight!', canvas.width/2, 50);
    };

    return () => {
      if (poseRef.current?.close) poseRef.current.close();
      if (cameraRef.current) cameraRef.current.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.body.removeChild(scriptPose);
      document.body.removeChild(scriptCamera);
    };
  }, []);

  const checkPosture = async () => {
    setIsMonitoring(true);
    setLastChecked(new Date());
    if (cameraRef.current) {
      cameraRef.current.start();
      setTimeout(() => {
        cameraRef.current?.stop();
        setIsMonitoring(false);
      }, 10000); // Run for 10 seconds instead of 5
    }
  };

  useEffect(() => {
    const initialTimer = setTimeout(checkPosture, 1000);
    intervalRef.current = setInterval(checkPosture, 300000); // Still every 5 minutes
    
    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getStatusColor = () => {
    switch(postureStatus) {
      case 'good': return 'bg-green-500';
      case 'bad': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatLastChecked = () => {
    if (!lastChecked) return 'Never';
    return lastChecked.toLocaleTimeString();
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Posture Monitor</h1>
      </div>
      
      <div className="app-content">
        <div className="camera-section">
          <div className="canvas-wrapper">
            <canvas 
              ref={canvasRef} 
              width="640" 
              height="480"
              className="posture-canvas"
            />
            {isMonitoring && (
              <div className="monitoring-indicator">
                Monitoring...
              </div>
            )}
          </div>
        </div>
        
        <div className="control-section">
          <div className="status-card">
            <h2>Posture Status</h2>
            <div className="status-indicator">
              <div className={`status-dot ${postureStatus}`}></div>
              <span className="status-text">
                {postureStatus === 'good' ? 'Good posture!' : 
                 postureStatus === 'bad' ? 'Improve your posture' : 'Waiting for data...'}
              </span>
            </div>
          </div>
          
          <div className="status-card">
            <h2>Last Check</h2>
            <p className="status-time">{lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}</p>
          </div>
          
          <div className="status-card">
            <h2>Next Check</h2>
            <p className="status-time">
              {lastChecked ? 
                new Date(lastChecked.getTime() + 300000).toLocaleTimeString() : 
                'Soon'}
            </p>
          </div>
          
          <button 
            onClick={checkPosture}
            className="check-button"
          >
            Check Posture Now
          </button>
        </div>
      </div>
      
      <div className="app-footer">
        <div className="tip-box">
          <span className="tip-icon">ℹ️</span>
          <p className="tip-text">
            For best results, sit about 2-3 feet from your camera and ensure your upper body is visible.
          </p>
        </div>
      </div>
      
      <video ref={videoRef} className="hidden-video" playsInline />
    </div>
  );
}

export default App;