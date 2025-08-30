import React, { useRef, useEffect, useState, useCallback } from 'react';
import './App.css';

function App() {
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const intervalRef = useRef(null);
  const isActiveRef = useRef(false);
  const timeoutRef = useRef(null);
  const streamRef = useRef(null);
  const notificationCooldownRef = useRef(0);
  const shouldProcessFramesRef = useRef(false); // NEW: Control frame processing

  // State
  const [postureStatus, setPostureStatus] = useState('neutral');
  const [cameraError, setCameraError] = useState(null);
  const [intervalMinutes, setIntervalMinutes] = useState(3);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [scriptsReady, setScriptsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cleanup all resources
  const stopAll = useCallback(async () => {
    isActiveRef.current = false;
    shouldProcessFramesRef.current = false; // NEW: Stop frame processing
    setIsMonitoring(false);
    notificationCooldownRef.current = 0;
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Stop camera processing
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.error('Error stopping camera:', e);
      }
      cameraRef.current = null;
    }

    // Close pose detection
    if (poseRef.current) {
      try {
        await poseRef.current.close();
      } catch (e) {
        console.error('Error closing pose detection:', e);
      }
      poseRef.current = null;
    }

    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    // Set status to neutral after stopping
    setPostureStatus('neutral');
  }, []);

  // Load MediaPipe scripts
  useEffect(() => {
    const loadScript = (src) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });

    const loadMediaPipe = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'),
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js')
        ]);
        setScriptsReady(true);
      } catch (error) {
        console.error('Failed to load MediaPipe:', error);
        setCameraError('Failed to load posture detection. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    loadMediaPipe();

    return () => {
      stopAll();
    };
  }, [stopAll]);

  const initializePoseDetection = useCallback(async () => {
    try {
      // Don't recreate pose if it already exists and is working
      if (poseRef.current) {
        return true;
      }

      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      pose.onResults((results) => {
        // NEW: Only process results if we should be processing frames
        if (!shouldProcessFramesRef.current || !canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (results.image) {
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        }

        if (results.poseLandmarks) {
          const lm = results.poseLandmarks;
          const leftShoulder = lm[11];
          const rightShoulder = lm[12];
          const leftEar = lm[7];
          const rightEar = lm[8];
          const nose = lm[0];

          if (leftShoulder && rightShoulder && leftEar && rightEar && nose) {
            const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
            const neckTilt = Math.abs(leftEar.y - rightEar.y);
            const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
            const headForward = Math.abs(nose.x - shoulderMidX) > 0.05;
            const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
            const headLow = nose.y > shoulderMidY + 0.05;

            const isBadPosture = shoulderDiff > 0.05 || neckTilt > 0.03 || headForward || headLow;

            setPostureStatus(isBadPosture ? 'bad' : 'good');
            
            // Send notification only if monitoring is active and cooldown has passed
            if (isBadPosture && window.electron?.sendPostureNotification && isActiveRef.current) {
              const now = Date.now();
              if (now - notificationCooldownRef.current > 30000) {
                window.electron.sendPostureNotification(true);
                notificationCooldownRef.current = now;
              }
            }
          }
        }
      });

      poseRef.current = pose;
      return true;
    } catch (error) {
      console.error('Pose initialization failed:', error);
      setCameraError('Pose detection failed to initialize');
      return false;
    }
  }, []);

  const checkPosture = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      // Clean up any previous session but keep pose detection
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.error('Error stopping camera:', e);
        }
        cameraRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      }).catch(err => {
        throw new Error('Camera access denied');
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      await new Promise((resolve) => {
        videoRef.current.onloadedmetadata = resolve;
      });
      
      await videoRef.current.play().catch(console.warn);

      const poseReady = await initializePoseDetection();
      if (!poseReady) return;

      // NEW: Start processing frames
      shouldProcessFramesRef.current = true;

      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => {
          // NEW: Only process frames if we should be processing
          if (!shouldProcessFramesRef.current || !poseRef.current) return;
          try {
            await poseRef.current.send({ image: videoRef.current });
          } catch (error) {
            // Ignore errors when not active
            if (shouldProcessFramesRef.current) {
              console.error('Frame processing error:', error);
            }
          }
        },
        width: 640,
        height: 480
      });

      await cameraRef.current.start();
      setIsMonitoring(true);

      // Check for 10 seconds
      await new Promise(resolve => {
        timeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            resolve();
          }
        }, 10000);
      });
    } catch (error) {
      console.error('Posture check failed:', error);
      setCameraError(error.message);
    } finally {
      // NEW: Stop processing frames before cleanup
      shouldProcessFramesRef.current = false;
      
      if (isActiveRef.current) {
        await stopAll();
      }
    }
  }, [initializePoseDetection, stopAll]);

  const startMonitoring = useCallback(() => {
    if (isActiveRef.current) return;
    
    isActiveRef.current = true;
    checkPosture();
    intervalRef.current = setInterval(checkPosture, intervalMinutes * 60 * 1000);
  }, [checkPosture, intervalMinutes]);

  const handleStop = useCallback(async () => {
    if (!isActiveRef.current) return;
    
    await stopAll();
  }, [stopAll]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Posture Monitor</h1>
      </header>
      <div className="app-content">
        <div className="camera-section" style={{ position: 'relative', width: '640px', margin: 'auto' }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="posture-canvas"
            style={{ borderRadius: '8px', backgroundColor: '#fff' }}
          />
          {isMonitoring && (
            <div
              className="monitoring-indicator"
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500',
                animation: 'pulse 1.5s infinite',
              }}
            >
              Monitoring...
            </div>
          )}
          <video
            ref={videoRef}
            width={640}
            height={480}
            className="hidden-video"
            muted
            playsInline
            style={{ display: 'block', position: 'absolute', top: 0, left: 0, opacity: 0 }}
          />
          <div className="action-buttons" style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              className="check-button"
              onClick={startMonitoring}
              disabled={!scriptsReady || isMonitoring || loading}
              style={{ marginRight: '10px' }}
            >
              {loading ? 'Loading...' : 'Start Monitoring'}
            </button>
            <button
              className="stop-button"
              onClick={handleStop}
              disabled={!isMonitoring}
            >
              Stop Monitoring
            </button>
          </div>
        </div>

        <div className="control-section" style={{ marginTop: '20px', textAlign: 'center' }}>
          <div className="status-card">
            <h2>Status</h2>
            <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span
                className={`status-dot ${postureStatus}`}
                style={{
                  display: 'inline-block',
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  backgroundColor:
                    postureStatus === 'good'
                      ? '#10b981'
                      : postureStatus === 'bad'
                      ? '#ef4444'
                      : '#fbbf24',
                }}
              />
              <span
                className={postureStatus === 'bad' ? 'error' : ''}
                style={{ fontSize: '18px', fontWeight: '600' }}
              >
                {postureStatus}
              </span>
            </div>
            {cameraError && <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>{cameraError}</div>}
          </div>
          <div style={{ marginTop: '15px' }}>
            <label>Check interval (minutes): </label>
            <input
              type="number"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
              min="1"
              max="60"
              style={{ padding: '5px', borderRadius: '6px', width: '60px' }}
            />
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;