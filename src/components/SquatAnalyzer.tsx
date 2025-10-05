import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import * as poseDetection from '@tensorflow-models/pose-detection';

type PoseKeypoint = { x: number; y: number; confidence: number };

type SquatAnalysis = {
  kneeAngle: number;
  hipAngle: number;
  backStraight: boolean;
  depthGood: boolean;
  balance: boolean;
  overallForm: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  feedback: string[];
};

export function SquatAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [poseReady, setPoseReady] = useState<boolean>(false);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<SquatAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [isInSquat, setIsInSquat] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setIsLoading(true);
      try {
        // Initialize TF backend: prefer WebGL, fallback to WASM
        try {
          await tf.setBackend('webgl');
        } catch {}
        await tf.ready();
        if (tf.getBackend() !== 'webgl') {
          try {
            await tf.setBackend('wasm');
            await tf.ready();
          } catch {}
        }

        if (!alive) return;

        // Create MoveNet Lightning detector
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: (poseDetection as any).movenet?.modelType?.SINGLEPOSE_LIGHTNING || 'Lightning' }
        );
        if (!alive) return;
        detectorRef.current = detector;
        setPoseReady(true);
      } catch (e) {
        console.warn('Pose init failed', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // Dispose detector on unmount
    return () => {
      try { (detectorRef.current as any)?.dispose?.(); } catch {}
    };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter(d => d.kind === 'videoinput');
      setDevices(vids);
      if (!selectedDeviceId && vids[0]?.deviceId) setSelectedDeviceId(vids[0].deviceId);
    } catch (e) {
      // noop; Safari may require permission first
    }
  }, [selectedDeviceId]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      const hasDevice = Boolean(selectedDeviceId);
      const constraints: MediaStreamConstraints = {
        video: hasDevice
          ? { width: 640, height: 480, deviceId: { exact: selectedDeviceId } }
          : { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setStream(mediaStream);
      setIsRecording(true);
      // Refresh device labels after permission granted
      refreshDevices();
    } catch (e) {
      console.warn('Camera error', e);
      const msg = (e as any)?.message || 'Unable to access camera';
      setCameraError(msg);
    }
  }, [selectedDeviceId, refreshDevices]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsRecording(false);
    setCameraError('');
  }, [stream]);

  const calculateAngle = (a: PoseKeypoint | undefined, b: PoseKeypoint | undefined, c: PoseKeypoint | undefined): number | null => {
    if (!a || !b || !c) return null;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * (180 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const analyzeSquatForm = (keypoints: PoseKeypoint[]): SquatAnalysis => {
    const get = (i: number): PoseKeypoint | undefined => {
      const p = keypoints[i];
      return p && p.confidence > 0.5 ? p : undefined;
    };

    const lShoulder = get(5), rShoulder = get(6);
    const lHip = get(11), rHip = get(12);
    const lKnee = get(13), rKnee = get(14);
    const lAnkle = get(15), rAnkle = get(16);

    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const leftHipAngle = calculateAngle(lShoulder, lHip, lKnee);
    const rightHipAngle = calculateAngle(rShoulder, rHip, rKnee);

    const kneeCandidates = [leftKneeAngle, rightKneeAngle].filter((v): v is number => v !== null);
    const hipCandidates = [leftHipAngle, rightHipAngle].filter((v): v is number => v !== null);

    const kneeAngle = kneeCandidates.length ? Math.min(...kneeCandidates) : 180;
    const hipAngle = hipCandidates.length ? Math.max(...hipCandidates) : 170;

    const depthGood = kneeAngle < 100;
    const backStraight = hipAngle > 150;

    // Simple balance heuristic: feet roughly symmetric under hips
    const balance = lAnkle && rAnkle && lHip && rHip ? Math.abs((lAnkle.x + rAnkle.x) / 2 - (lHip.x + rHip.x) / 2) < 40 : true;

    let overallForm: SquatAnalysis['overallForm'] = 'excellent';
    const feedback: string[] = [];
    if (!depthGood) { feedback.push('Go deeper - aim to get your thighs parallel to the ground'); overallForm = 'needs-improvement'; }
    if (!backStraight) { feedback.push('Keep your back straight and chest up'); overallForm = 'needs-improvement'; }
    if (!balance) { feedback.push('Focus on keeping your weight centered over your feet'); overallForm = 'needs-improvement'; }
    if (depthGood && backStraight && balance) feedback.push('Excellent form! Keep it up!');

    // Rep counting via angle thresholds with hysteresis
    if (kneeAngle > 150 && isInSquat) { setRepCount(r => r + 1); setIsInSquat(false); }
    else if (kneeAngle < 95 && !isInSquat) { setIsInSquat(true); }

    return { kneeAngle, hipAngle, backStraight, depthGood, balance, overallForm, feedback };
  };

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !poseReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the latest video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Estimate pose
    const detector = detectorRef.current;
    let keypoints: PoseKeypoint[] = [];
    if (detector) {
      try {
        const poses = await detector.estimatePoses(videoRef.current, { flipHorizontal: true });
        const kp = poses?.[0]?.keypoints || [];
        keypoints = kp.map((k: any) => ({ x: k.x, y: k.y, confidence: k.score ?? k.confidence ?? 0 }));
      } catch (e) {
        // If inference fails, keep keypoints empty for this frame
      }
    }

    // Advance frame counter (used by current simulated analysis)
    setFrameCount(prev => prev + 1);

    // Use existing analysis for now (angles/state machine will be wired next)
    const analysis = analyzeSquatForm(keypoints);
    setCurrentAnalysis(analysis);

    // Draw detected keypoints and skeleton
    ctx.strokeStyle = analysis.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    ctx.lineWidth = 3;
    ctx.fillStyle = analysis.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    keypoints.forEach(p => {
      if (p.confidence > 0.5) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    const edges: Array<[number, number]> = [
      [5, 6], [11, 12], // shoulders, hips
      [5, 7], [7, 9],   // left arm
      [6, 8], [8, 10],  // right arm
      [11, 13], [13, 15], // left leg
      [12, 14], [14, 16], // right leg
      [5, 11], [6, 12], // torso sides
      [0, 1], [0, 2], [1, 3], [2, 4], // head
    ];
    ctx.beginPath();
    edges.forEach(([a, b]) => {
      const pa = keypoints[a];
      const pb = keypoints[b];
      if (pa && pb && pa.confidence > 0.5 && pb.confidence > 0.5) {
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
    });
    ctx.stroke();
  }, [poseReady, frameCount, isInSquat]);

  useEffect(() => {
    if (!isRecording) return;
    const loop = () => {
      processFrame();
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; };
  }, [isRecording, processFrame]);

  // Try to populate device list once (labels may be empty until permission is granted)
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const badgeClass = (variant: 'good' | 'bad') => variant === 'good' ? 'bg-blue-600 text-white' : 'bg-red-500 text-white';

  const resetSession = () => { setRepCount(0); setCurrentAnalysis(null); setIsInSquat(false); };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">AI Squat Form Analyzer</h1>
          <p className="text-gray-600">Get real-time feedback on your squat technique</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full object-cover" />
              {!isRecording && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">📷</div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              {!isRecording ? (
                <button onClick={startCamera} disabled={isLoading} className="py-2 px-4 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">{isLoading ? 'Loading…' : 'Start Analysis'}</button>
              ) : (
                <button onClick={stopCamera} className="py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700">Stop</button>
              )}
              <button onClick={resetSession} className="py-2 px-4 rounded-xl border border-gray-300">Reset</button>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="py-2 px-3 border border-gray-300 rounded-xl text-sm"
                >
                  {devices.length === 0 && <option value="">Default camera</option>}
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                  ))}
                </select>
                <button onClick={refreshDevices} className="py-2 px-3 rounded-xl border border-gray-300 text-sm">Refresh</button>
              </div>
            </div>

            {cameraError && (
              <div className="mt-3 text-sm text-red-600 text-center">{cameraError}</div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Rep Count</h3>
              <div className="text-5xl font-bold text-blue-600 mb-2">{repCount}</div>
              <p className="text-sm text-gray-500">Good squats completed</p>
            </div>

            {currentAnalysis && (
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Form Analysis</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentAnalysis.overallForm === 'excellent' ? 'bg-blue-600 text-white' : 'bg-yellow-500 text-white'}`}>{currentAnalysis.overallForm.replace('-', ' ')}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Depth</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.depthGood ? 'good' : 'bad')}`}>{currentAnalysis.depthGood ? 'Good' : 'Too shallow'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Back Position</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.backStraight ? 'good' : 'bad')}`}>{currentAnalysis.backStraight ? 'Straight' : 'Rounded'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Balance</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.balance ? 'good' : 'bad')}`}>{currentAnalysis.balance ? 'Centered' : 'Off-center'}</span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Feedback</h4>
                  <ul className="space-y-1">
                    {currentAnalysis.feedback.map((tip, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start"><span className="text-blue-600 mr-2">•</span>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-3">How to Use</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start"><span className="text-blue-600 mr-2">1.</span>Position yourself in front of the camera</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">2.</span>Start the analysis and begin squatting</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">3.</span>Follow the real-time feedback to improve your form</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">4.</span>Track your reps and progress over time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SquatAnalyzer;


