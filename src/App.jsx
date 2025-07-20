import React, { useRef, useEffect } from 'react';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let scriptsLoaded = 0;
    const requiredScripts = 2; // We're loading 2 scripts

    const checkInitialization = () => {
      scriptsLoaded++;
      if (scriptsLoaded === requiredScripts) {
        initializePoseDetection();
      }
    };

    // Load MediaPipe Pose script
    const scriptPose = document.createElement('script');
    scriptPose.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    scriptPose.onload = checkInitialization;
    document.body.appendChild(scriptPose);

    // Load Camera Utils script
    const scriptCamera = document.createElement('script');
    scriptCamera.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    scriptCamera.onload = checkInitialization;
    document.body.appendChild(scriptCamera);

    const initializePoseDetection = () => {
      // Both scripts are now loaded
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.poseLandmarks) {
          const leftShoulder = results.poseLandmarks[11];
          const rightShoulder = results.poseLandmarks[12];

          if (leftShoulder.y > 0.7 || rightShoulder.y > 0.7) {
            alert("⚠️ Sit up straight!");
          }
        }
      });

      // Initialize camera - now safe to use window.Camera
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

    return () => {
      if (poseRef.current?.close) poseRef.current.close();
      if (cameraRef.current) cameraRef.current.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.body.removeChild(scriptPose);
      document.body.removeChild(scriptCamera);
    };
  }, []);

  const checkPosture = async () => {
    if (cameraRef.current) {
      cameraRef.current.start();
      setTimeout(() => {
        cameraRef.current?.stop();
      }, 5000); // Stop after 5 seconds
    }
  };

  useEffect(() => {
    // Start checking immediately (after components mount)
    const initialTimer = setTimeout(checkPosture, 1000);
    
    // Then check every 5 minutes (300000ms)
    intervalRef.current = setInterval(checkPosture, 300000);
    
    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Posture Monitor</h1>
      <video 
        ref={videoRef} 
        style={{ width: '640px', height: '480px', display: 'none' }} 
        playsInline
      />
      <canvas 
        ref={canvasRef} 
        width="640" 
        height="480" 
        style={{ border: '1px solid black' }}
      />
      <p>Camera will activate every 5 minutes to check your posture.</p>
    </div>
  );
}

export default App;