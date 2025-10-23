import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import * as poseDetection from '@tensorflow-models/pose-detection';

type PoseKeypoint = { x: number; y: number; confidence: number };

type PushupAnalysis = {
  chestDepthGood: boolean;
  torsoRigid: boolean;
  elbowLockout: boolean;
  overallForm: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  feedback: string[];
};

export function PushupAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [poseReady, setPoseReady] = useState<boolean>(false);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<PushupAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const smoothedKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const phaseRef = useRef<'top' | 'bottom' | 'moving'>('top');
  const bottomHoldRef = useRef<number>(0);
  const topHoldRef = useRef<number>(0);
  const inPositionRef = useRef<boolean>(false);
  const positionHoldRef = useRef<number>(0);
  const positionDropRef = useRef<number>(0);
  const lastRepAtRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setIsLoading(true);
      try {
        try { await tf.setBackend('webgl'); } catch {}
        await tf.ready();
        if (tf.getBackend() !== 'webgl') { try { await tf.setBackend('wasm'); await tf.ready(); } catch {} }
        if (!alive) return;
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: (poseDetection as any).movenet?.modelType?.SINGLEPOSE_LIGHTNING || 'Lightning' }
        );
        if (!alive) return;
        detectorRef.current = detector;
        setPoseReady(true);
      } catch (e) { console.warn('Pose init failed', e); } finally { setIsLoading(false); }
    };
    init();
    return () => { alive = false; };
  }, []);

  useEffect(() => { return () => { try { (detectorRef.current as any)?.dispose?.(); } catch {} }; }, []);

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
        video: hasDevice ? { width: 640, height: 480, deviceId: { exact: selectedDeviceId } } : { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      setStream(mediaStream);
      setIsRecording(true);
      refreshDevices();
    } catch (e) { console.warn('Camera error', e); const msg = (e as any)?.message || 'Unable to access camera'; setCameraError(msg); }
  }, [selectedDeviceId, refreshDevices]);

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
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

  const analyze = (keypoints: PoseKeypoint[]): PushupAnalysis => {
    const get = (i: number): PoseKeypoint | undefined => {
      const p = keypoints[i];
      return p && p.confidence > 0.5 ? p : undefined;
    };

    const lShoulder = get(5), rShoulder = get(6);
    const lElbow = get(7), rElbow = get(8);
    const lWrist = get(9), rWrist = get(10);
    const lHip = get(11), rHip = get(12);
    const lKnee = get(13), rKnee = get(14);
    const lAnkle = get(15), rAnkle = get(16);

    // Choose one side based on summed confidence
    const leftConf = [lShoulder, lElbow, lWrist, lHip, lKnee, lAnkle].reduce((s, p) => s + (p?.confidence || 0), 0);
    const rightConf = [rShoulder, rElbow, rWrist, rHip, rKnee, rAnkle].reduce((s, p) => s + (p?.confidence || 0), 0);
    const useLeft = leftConf >= rightConf;
    const shoulder = useLeft ? lShoulder : rShoulder;
    const elbow = useLeft ? lElbow : rElbow;
    const wrist = useLeft ? lWrist : rWrist;
    const hip = useLeft ? lHip : rHip;
    const ankle = useLeft ? lAnkle : rAnkle;

    // Chest depth proxy: elbow angle (shoulder-elbow-wrist)
    const elbowAngle = calculateAngle(shoulder, elbow, wrist) ?? 180;
    const chestDepthGood = elbowAngle < 95; // below ~90 at bottom

    // Torso rigid: hip near line between shoulder and ankle (similar to plank)
    let torsoRigid = true;
    if (shoulder && hip && ankle) {
      const A = shoulder, B = ankle, P = hip;
      const num = Math.abs((B.y - A.y) * P.x - (B.x - A.x) * P.y + B.x * A.y - B.y * A.x);
      const den = Math.hypot(B.y - A.y, B.x - A.x) || 1;
      const dist = num / den;
      const seg = den;
      torsoRigid = dist < 0.08 * seg; // within 8%
    }

    // Lockout at top: elbow extended
    const elbowLockout = elbowAngle > 160;

    let overallForm: PushupAnalysis['overallForm'] = 'excellent';
    const feedback: string[] = [];
    if (!chestDepthGood) { feedback.push('Lower to ~90° elbow bend'); overallForm = 'needs-improvement'; }
    if (!torsoRigid) { feedback.push('Keep torso rigid—avoid hips sagging/piking'); overallForm = 'needs-improvement'; }
    if (!elbowLockout) { feedback.push('Lock out fully at the top'); overallForm = 'needs-improvement'; }
    if (chestDepthGood && torsoRigid && elbowLockout) feedback.push('Excellent rep!');

    return { chestDepthGood, torsoRigid, elbowLockout, overallForm, feedback };
  };

  const computeInPosition = (raw: PoseKeypoint[], smoothed: PoseKeypoint[], canvasW: number): boolean => {
    const pick = (arr: PoseKeypoint[], i: number) => arr[i] && arr[i].confidence > 0.5 ? arr[i] : undefined;
    const lS = pick(raw, 5), rS = pick(raw, 6);
    const lE = pick(raw, 7), rE = pick(raw, 8);
    const lW = pick(raw, 9), rW = pick(raw, 10);
    const lH = pick(raw, 11), rH = pick(raw, 12);
    const lA = pick(raw, 15), rA = pick(raw, 16);

    // Require essential joints with stronger confidence
    const minConf = 0.6;
    const ok = (p?: PoseKeypoint) => (p?.confidence || 0) >= minConf;
    const hasLeft = ok(lS) && ok(lE) && ok(lW) && ok(lH) && ok(lA);
    const hasRight = ok(rS) && ok(rE) && ok(rW) && ok(rH) && ok(rA);
    if (!hasLeft && !hasRight) return false;

    // Choose side by summed confidence
    const leftConf = [lS, lE, lW, lH, lA].reduce((s, p) => s + (p?.confidence || 0), 0);
    const rightConf = [rS, rE, rW, rH, rA].reduce((s, p) => s + (p?.confidence || 0), 0);
    const useLeft = leftConf >= rightConf;
    const s = useLeft ? pick(smoothed, 5) : pick(smoothed, 6);
    const e = useLeft ? pick(smoothed, 7) : pick(smoothed, 8);
    const w = useLeft ? pick(smoothed, 9) : pick(smoothed, 10);
    const h = useLeft ? pick(smoothed, 11) : pick(smoothed, 12);
    const a = useLeft ? pick(smoothed, 15) : pick(smoothed, 16);
    if (!(s && e && w && h && a)) return false;

    // Horizontal body: |dy|/|dx| small (tilt < ~25°)
    const dx = a.x - s.x; const dy = a.y - s.y;
    const tiltDeg = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const horizontal = tiltDeg < 25;

    // Body length should be significant (avoid close-up partials)
    const bodyLen = Math.hypot(dx, dy);
    if (bodyLen < 0.35 * canvasW) return false;

    // Torso rigid: hip near line shoulder-ankle
    const A = s, B = a, P = h;
    const num = Math.abs((B.y - A.y) * P.x - (B.x - A.x) * P.y + B.x * A.y - B.y * A.x);
    const den = Math.hypot(B.y - A.y, B.x - A.x) || 1;
    const dist = num / den;
    const torsoRigid = dist < 0.08 * den;

    // Shoulder over wrist horizontally
    const upperArm = Math.hypot((s.x - e.x), (s.y - e.y)) || 1;
    const shoulderOverWrist = Math.abs(s.x - w.x) < 0.4 * upperArm;

    // Hip below shoulder
    const orderingOk = h.y > s.y + 10;

    return horizontal && torsoRigid && shoulderOverWrist && orderingOk;
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
      return { x: alphaPos * p.x + (1 - alphaPos) * prevP.x, y: alphaPos * p.y + (1 - alphaPos) * prevP.y, confidence: p.confidence };
    });
    smoothedKeypointsRef.current = smoothed;

    const analysis = analyze(smoothed);
    setCurrentAnalysis(analysis);

    // Position gating with hysteresis (use raw confidences and smoothed geometry)
    const inPos = computeInPosition(keypoints, smoothed, canvas.width);
    if (inPos) { positionHoldRef.current += 1; positionDropRef.current = 0; }
    else { positionDropRef.current += 1; positionHoldRef.current = 0; }
    if (!inPositionRef.current && positionHoldRef.current >= 5) inPositionRef.current = true; // ~5 frames
    if (inPositionRef.current && positionDropRef.current >= 8) inPositionRef.current = false; // drop slower

    // Rep state machine with small hysteresis
    const elbowAngle = (() => {
      const get = (i: number): PoseKeypoint | undefined => smoothed[i] && smoothed[i].confidence > 0.5 ? smoothed[i] : undefined;
      const lShoulder = get(5), rShoulder = get(6);
      const lElbow = get(7), rElbow = get(8);
      const lWrist = get(9), rWrist = get(10);
      const left = (calculateAngle(lShoulder, lElbow, lWrist) ?? 180);
      const right = (calculateAngle(rShoulder, rElbow, rWrist) ?? 180);
      return Math.min(left, right);
    })();

    const bottomThresh = 95;  // below ~90
    const topThresh = 160;    // extended
    if (inPositionRef.current) {
      if (elbowAngle < bottomThresh) { bottomHoldRef.current += 1; topHoldRef.current = 0; }
      else if (elbowAngle > topThresh) { topHoldRef.current += 1; bottomHoldRef.current = 0; }
      else { bottomHoldRef.current = 0; topHoldRef.current = 0; }

      // Only progress phases with good form
      const goodBottom = analysis.chestDepthGood && analysis.torsoRigid;
      const goodTop = analysis.elbowLockout && analysis.torsoRigid;

      if (phaseRef.current !== 'bottom' && bottomHoldRef.current >= 2 && goodBottom) phaseRef.current = 'bottom';
      if (phaseRef.current === 'bottom' && elbowAngle > bottomThresh + 10) phaseRef.current = 'moving';
      if (phaseRef.current !== 'top' && topHoldRef.current >= 2 && goodTop) {
        const now = performance.now();
        if (now - lastRepAtRef.current > 350) { setRepCount(r => r + 1); lastRepAtRef.current = now; }
        phaseRef.current = 'top';
      }
    } else {
      // Not in position: do not count or progress
      bottomHoldRef.current = 0; topHoldRef.current = 0; phaseRef.current = 'top';
    }

    ctx.strokeStyle = analysis.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    ctx.lineWidth = 3;
    ctx.fillStyle = analysis.overallForm === 'excellent' ? '#00BCD4' : '#FF9800';
    smoothed.forEach(p => { if (p.confidence > 0.5) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.fill(); } });

    const edges: Array<[number, number]> = [
      [5, 6], [11, 12],
      [5, 7], [7, 9], [6, 8], [8, 10],
      [11, 13], [13, 15], [12, 14], [14, 16],
      [5, 11], [6, 12],
      [0, 1], [0, 2], [1, 3], [2, 4],
    ];
    ctx.beginPath();
    edges.forEach(([a, b]) => {
      const pa = smoothed[a]; const pb = smoothed[b];
      if (pa && pb && pa.confidence > 0.5 && pb.confidence > 0.5) { ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); }
    });
    ctx.stroke();
  }, [poseReady]);

  useEffect(() => {
    if (!isRecording) return;
    const loop = () => { processFrame(); rafIdRef.current = requestAnimationFrame(loop); };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; };
  }, [isRecording, processFrame]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const resetSession = () => { setRepCount(0); setCurrentAnalysis(null); phaseRef.current = 'top'; };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">AI Push-up Form Analyzer</h1>
          <p className="text-gray-600">Get real-time feedback on your push-up technique</p>
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
                <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} className="py-2 px-3 border border-gray-300 rounded-xl text-sm">
                  {devices.length === 0 && <option value="">Default camera</option>}
                  {devices.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>))}
                </select>
                <button onClick={refreshDevices} className="py-2 px-3 rounded-xl border border-gray-300 text-sm">Refresh</button>
              </div>
            </div>

            {cameraError && (<div className="mt-3 text-sm text-red-600 text-center">{cameraError}</div>)}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Rep Count</h3>
              <div className="text-5xl font-bold text-blue-600 mb-2">{repCount}</div>
              <p className="text-sm text-gray-500">Good push-ups completed</p>
            </div>

            {currentAnalysis && (
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Form Analysis</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentAnalysis.overallForm === 'excellent' ? 'bg-blue-600 text-white' : 'bg-yellow-500 text-white'}`}>{currentAnalysis.overallForm.replace('-', ' ')}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center"><span className="text-sm">Chest Depth</span><span className={`text-xs px-2 py-1 rounded-full ${currentAnalysis.chestDepthGood ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{currentAnalysis.chestDepthGood ? 'Good' : 'Not low enough'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm">Torso Rigid</span><span className={`text-xs px-2 py-1 rounded-full ${currentAnalysis.torsoRigid ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{currentAnalysis.torsoRigid ? 'Good' : 'Sag/Pike'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm">Lockout</span><span className={`text-xs px-2 py-1 rounded-full ${currentAnalysis.elbowLockout ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{currentAnalysis.elbowLockout ? 'Complete' : 'Incomplete'}</span></div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Feedback</h4>
                  <ul className="space-y-1">{currentAnalysis.feedback.map((tip, idx) => (<li key={idx} className="text-sm text-gray-600 flex items-start"><span className="text-blue-600 mr-2">•</span>{tip}</li>))}</ul>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-3">How to Use</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start"><span className="text-blue-600 mr-2">1.</span>Side/profile to the camera; full body visible</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">2.</span>Start the analysis and perform push-ups</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">3.</span>Follow the real-time feedback to improve your form</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PushupAnalyzer;


