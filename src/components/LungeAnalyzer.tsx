import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import * as poseDetection from '@tensorflow-models/pose-detection';

type PoseKeypoint = { x: number; y: number; confidence: number };

type LungeAnalysis = {
  frontKneeAngle: number;
  backKneeAngle: number;
  torsoUpright: boolean;
  kneeAlignment: boolean;
  depth: boolean;
  overallForm: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  feedback: string[];
};

export function LungeAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [poseReady, setPoseReady] = useState<boolean>(false);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<LungeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [isInLunge, setIsInLunge] = useState(false);
  const bottomHoldFramesRef = useRef<number>(0);
  const topHoldFramesRef = useRef<number>(0);
  const torsoUprightPrevRef = useRef<boolean>(true);
  const kneeAlignPrevRef = useRef<boolean>(true);
  const lastRepAtRef = useRef<number>(0);
  const smoothedKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const lungeStateRef = useRef<'top' | 'bottom' | 'transition'>('top');
  const rafIdRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setIsLoading(true);
      try {
        try { await tf.setBackend('webgl'); } catch {}
        await tf.ready();
        if (tf.getBackend() !== 'webgl') {
          try { await tf.setBackend('wasm'); await tf.ready(); } catch {}
        }
        if (!alive) return;
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
    return () => { try { (detectorRef.current as any)?.dispose?.(); } catch {} };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter(d => d.kind === 'videoinput');
      setDevices(vids);
      if (!selectedDeviceId && vids[0]?.deviceId) setSelectedDeviceId(vids[0].deviceId);
    } catch {}
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

  const analyzeLungeForm = (keypoints: PoseKeypoint[]): LungeAnalysis => {
    const get = (i: number): PoseKeypoint | undefined => {
      const p = keypoints[i];
      return p && p.confidence > 0.5 ? p : undefined;
    };

    const lShoulder = get(5), rShoulder = get(6);
    const lHip = get(11), rHip = get(12);
    const lKnee = get(13), rKnee = get(14);
    const lAnkle = get(15), rAnkle = get(16);

    // Thresholds (lunges, sagittal view)
    const topKneeAngleThresh = 165; // standing
    const exitFrontThresh = 125;    // leave bottom
    const exitBackThresh = 120;     // leave bottom
    const bottomFrontThresh = 115;  // good front depth
    const bottomBackThresh = 110;   // good back depth
    const enterHoldFrames = 3;      // confirm bottom
    const exitHoldFrames = 3;       // confirm top

    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);

    // Determine front/back consistently via ankle distance from hip center (sagittal)
    const hipCenterX = (lHip && rHip) ? (lHip.x + rHip.x) / 2 : undefined;
    const leftAnkleDist = (hipCenterX != null && lAnkle) ? Math.abs(lAnkle.x - hipCenterX) : -1;
    const rightAnkleDist = (hipCenterX != null && rAnkle) ? Math.abs(rAnkle.x - hipCenterX) : -1;
    const frontIsLeft = leftAnkleDist >= rightAnkleDist;
    const frontKneeAngle = (frontIsLeft ? leftKneeAngle : rightKneeAngle) ?? 180;
    const backKneeAngle = (frontIsLeft ? rightKneeAngle : leftKneeAngle) ?? 180;

    // Depth condition: deep back knee and reasonable front knee flexion
    const depth = backKneeAngle < bottomBackThresh && frontKneeAngle < bottomFrontThresh;

    // Torso upright: de-roll using shoulder line, then measure tilt from vertical with hysteresis
    let torsoUpright = torsoUprightPrevRef.current;
    if (lShoulder && rShoulder && (lHip || rHip)) {
      const roll = Math.atan2(rShoulder.y - lShoulder.y, rShoulder.x - lShoulder.x);
      const hipMid = (lHip && rHip) ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 } : (lHip || rHip)!;
      const rot = (p: PoseKeypoint | undefined) => {
        if (!p) return null;
        const cx = p.x - hipMid.x; const cy = p.y - hipMid.y;
        const rx =  Math.cos(-roll) * cx - Math.sin(-roll) * cy;
        const ry =  Math.sin(-roll) * cx + Math.cos(-roll) * cy;
        return { x: rx, y: ry };
      };
      const sh = rot((Math.abs(rShoulder.x - hipMid.x) > Math.abs(lShoulder.x - hipMid.x)) ? rShoulder : lShoulder);
      const hp = { x: 0, y: 0 };
      if (sh) {
        const tilt = Math.abs(Math.atan2(sh.x - hp.x, sh.y - hp.y)) * 180 / Math.PI;
        const good = 30, bad = 35;
        if (tilt < good) torsoUpright = true;
        else if (tilt > bad) torsoUpright = false;
      }
    }
    torsoUprightPrevRef.current = torsoUpright;

    // Knee alignment (front) scaled by tibia length with hysteresis
    let kneeAlignment = kneeAlignPrevRef.current;
    const frontKneePt = frontIsLeft ? lKnee : rKnee;
    const frontAnklePt = frontIsLeft ? lAnkle : rAnkle;
    if (frontKneePt && frontAnklePt) {
      const tibiaLen = Math.hypot(frontKneePt.x - frontAnklePt.x, frontKneePt.y - frontAnklePt.y);
      const dx = Math.abs(frontKneePt.x - frontAnklePt.x);
      const goodThresh = 0.30 * tibiaLen;
      const badThresh = 0.40 * tibiaLen;
      if (dx <= goodThresh) kneeAlignment = true;
      else if (dx >= badThresh) kneeAlignment = false;
    }
    kneeAlignPrevRef.current = kneeAlignment;

    let overallForm: LungeAnalysis['overallForm'] = 'excellent';
    const feedback: string[] = [];
    if (!depth) { feedback.push('Go lower - back knee should nearly touch the ground'); overallForm = 'needs-improvement'; }
    if (!torsoUpright) { feedback.push('Keep your torso upright - avoid leaning forward'); overallForm = 'needs-improvement'; }
    if (!kneeAlignment) { feedback.push('Keep your front knee aligned over your ankle'); overallForm = 'needs-improvement'; }
    if (depth && torsoUpright && kneeAlignment) feedback.push('Excellent form! Keep it up!');

    // Rep counting with clearer state + debounce
    const now = performance.now();
    const atBottom = depth;
    const leavingBottom = frontKneeAngle > exitFrontThresh || backKneeAngle > exitBackThresh;
    const atTop = frontKneeAngle > topKneeAngleThresh;

    if (atBottom) {
      bottomHoldFramesRef.current += 1; topHoldFramesRef.current = 0;
    } else if (atTop) {
      topHoldFramesRef.current += 1; bottomHoldFramesRef.current = 0;
    } else {
      bottomHoldFramesRef.current = 0; topHoldFramesRef.current = 0;
    }

    if (lungeStateRef.current !== 'bottom' && bottomHoldFramesRef.current >= enterHoldFrames) {
      lungeStateRef.current = 'bottom';
    }

    if (lungeStateRef.current === 'bottom' && leavingBottom) {
      lungeStateRef.current = 'transition';
    }

    if (lungeStateRef.current !== 'top' && topHoldFramesRef.current >= exitHoldFrames) {
      if (now - lastRepAtRef.current > 150) {
        setRepCount(r => r + 1);
        lastRepAtRef.current = now;
      }
      lungeStateRef.current = 'top';
    }

    return { frontKneeAngle: frontKneeAngle ?? 180, backKneeAngle: backKneeAngle ?? 180, torsoUpright, kneeAlignment, depth, overallForm, feedback };
  };

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !poseReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const detector = detectorRef.current;
    let keypoints: PoseKeypoint[] = [];
    if (detector) {
      try {
        const poses = await detector.estimatePoses(videoRef.current, { flipHorizontal: true });
        const kp = poses?.[0]?.keypoints || [];
        keypoints = kp.map((k: any) => ({ x: k.x, y: k.y, confidence: k.score ?? k.confidence ?? 0 }));
      } catch {}
    }

    // EMA smoothing with confidence gating
    const alphaPos = 0.35;
    const prev = smoothedKeypointsRef.current;
    const smoothed: PoseKeypoint[] = keypoints.map((p, i) => {
      const prevP = prev?.[i];
      const confOk = (p.confidence ?? 0) >= 0.4;
      if (!prevP || !confOk) return prevP ? { ...prevP } : p;
      return {
        x: alphaPos * p.x + (1 - alphaPos) * prevP.x,
        y: alphaPos * p.y + (1 - alphaPos) * prevP.y,
        confidence: p.confidence,
      };
    });
    smoothedKeypointsRef.current = smoothed;

    const analysis = analyzeLungeForm(smoothed);
    setCurrentAnalysis(analysis);

    ctx.strokeStyle = currentAnalysis?.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    ctx.lineWidth = 3;
    ctx.fillStyle = currentAnalysis?.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    keypoints.forEach(p => {
      if (p.confidence > 0.5) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.fill();
      }
    });

    const edges: Array<[number, number]> = [
      [5, 6], [11, 12],
      [5, 7], [7, 9], [6, 8], [8, 10],
      [11, 13], [13, 15], [12, 14], [14, 16],
      [5, 11], [6, 12],
      [0, 1], [0, 2], [1, 3], [2, 4],
    ];
    ctx.beginPath();
    edges.forEach(([a, b]) => {
      const pa = keypoints[a]; const pb = keypoints[b];
      if (pa && pb && pa.confidence > 0.5 && pb.confidence > 0.5) { ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); }
    });
    ctx.stroke();
  }, [poseReady, currentAnalysis?.overallForm, isInLunge]);

  useEffect(() => {
    if (!isRecording) return;
    const loop = () => { processFrame(); rafIdRef.current = requestAnimationFrame(loop); };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; };
  }, [isRecording, processFrame]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const badgeClass = (variant: 'good' | 'bad') => variant === 'good' ? 'bg-blue-600 text-white' : 'bg-red-500 text-white';
  const resetSession = () => { setRepCount(0); setCurrentAnalysis(null); setIsInLunge(false); };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">AI Lunge Form Analyzer</h1>
          <p className="text-gray-600">Get real-time feedback on your lunge technique</p>
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
              <p className="text-sm text-gray-500">Good lunges completed</p>
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
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.depth ? 'good' : 'bad')}`}>{currentAnalysis.depth ? 'Good' : 'Too shallow'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Torso Position</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.torsoUpright ? 'good' : 'bad')}`}>{currentAnalysis.torsoUpright ? 'Upright' : 'Leaning'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Knee Alignment</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(currentAnalysis.kneeAlignment ? 'good' : 'bad')}`}>{currentAnalysis.kneeAlignment ? 'Good' : 'Over toes'}</span>
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
                <li className="flex items-start"><span className="text-blue-600 mr-2">2.</span>Start the analysis and begin lunging</li>
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

export default LungeAnalyzer;


