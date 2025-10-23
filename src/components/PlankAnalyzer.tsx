import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import * as poseDetection from '@tensorflow-models/pose-detection';

type PoseKeypoint = { x: number; y: number; confidence: number };

type PlankAnalysis = {
  hipSag: boolean;
  hipPike: boolean;
  straightLine: boolean;
  shoulderOverElbow: boolean;
  overallForm: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  feedback: string[];
  holdSeconds: number;
};

export function PlankAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [poseReady, setPoseReady] = useState<boolean>(false);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<PlankAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const smoothedKeypointsRef = useRef<PoseKeypoint[] | null>(null);

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
      setStartTime(performance.now());
      refreshDevices();
    } catch (e) { console.warn('Camera error', e); const msg = (e as any)?.message || 'Unable to access camera'; setCameraError(msg); }
  }, [selectedDeviceId, refreshDevices]);

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsRecording(false);
    setCameraError('');
    setStartTime(null);
  }, [stream]);

  const calculateAngle = (a: PoseKeypoint | undefined, b: PoseKeypoint | undefined, c: PoseKeypoint | undefined): number | null => {
    if (!a || !b || !c) return null;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * (180 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const analyze = (keypoints: PoseKeypoint[]): PlankAnalysis => {
    const get = (i: number): PoseKeypoint | undefined => {
      const p = keypoints[i];
      return p && p.confidence > 0.5 ? p : undefined;
    };

    const lShoulder = get(5), rShoulder = get(6);
    const lHip = get(11), rHip = get(12);
    const lKnee = get(13), rKnee = get(14);
    const lAnkle = get(15), rAnkle = get(16);
    const lElbow = get(7), rElbow = get(8);

    // Use side with higher confidence span
    const hip = (lHip && rHip) ? (lHip.confidence >= rHip.confidence ? lHip : rHip) : (lHip || rHip);
    const shoulder = (lShoulder && rShoulder) ? (lShoulder.confidence >= rShoulder.confidence ? lShoulder : rShoulder) : (lShoulder || rShoulder);
    const knee = (lKnee && rKnee) ? (lKnee.confidence >= rKnee.confidence ? lKnee : rKnee) : (lKnee || rKnee);
    const ankle = (lAnkle && rAnkle) ? (lAnkle.confidence >= rAnkle.confidence ? lAnkle : rAnkle) : (lAnkle || rAnkle);
    const elbow = (lElbow && rElbow) ? (lElbow.confidence >= rElbow.confidence ? lElbow : rElbow) : (lElbow || rElbow);

    // Straight line: hip near line between shoulder and ankle
    let straightLine = true;
    if (shoulder && hip && ankle) {
      // distance of hip to line shoulder-ankle normalized by segment length
      const A = shoulder, B = ankle, P = hip;
      const num = Math.abs((B.y - A.y) * P.x - (B.x - A.x) * P.y + B.x * A.y - B.y * A.x);
      const den = Math.hypot(B.y - A.y, B.x - A.x) || 1;
      const dist = num / den;
      const seg = den;
      straightLine = dist < 0.06 * seg; // within 6% of body line
    }

    // Hip sag/pike via hip angle (shoulder-hip-knee)
    const hipAngle = calculateAngle(shoulder, hip, knee);
    const hipSag = (hipAngle ?? 180) > 195;  // hips too low (extended)
    const hipPike = (hipAngle ?? 180) < 150; // hips too high (piked)

    // Shoulder over elbow in forearm plank
    let shoulderOverElbow = true;
    if (shoulder && elbow) {
      const dx = Math.abs(shoulder.x - elbow.x);
      const upperArm = hip && shoulder ? Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y) : 200;
      shoulderOverElbow = dx < 0.35 * upperArm; // within 35% horizontal
    }

    let overallForm: PlankAnalysis['overallForm'] = 'excellent';
    const feedback: string[] = [];
    if (!straightLine) { feedback.push('Keep a straight line from shoulders to ankles'); overallForm = 'needs-improvement'; }
    if (hipSag) { feedback.push('Lift your hips slightly to avoid sagging'); overallForm = 'needs-improvement'; }
    if (hipPike) { feedback.push('Lower your hips to avoid piking'); overallForm = 'needs-improvement'; }
    if (!shoulderOverElbow) { feedback.push('Stack shoulders over elbows'); overallForm = 'needs-improvement'; }
    if (straightLine && !hipSag && !hipPike && shoulderOverElbow) feedback.push('Excellent form! Hold steady.');

    const holdSeconds = startTime ? Math.max(0, (performance.now() - startTime) / 1000) : 0;

    return { hipSag, hipPike, straightLine, shoulderOverElbow, overallForm, feedback, holdSeconds };
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
  }, [poseReady, startTime]);

  useEffect(() => {
    if (!isRecording) return;
    const loop = () => { processFrame(); rafIdRef.current = requestAnimationFrame(loop); };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; };
  }, [isRecording, processFrame]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const resetSession = () => { setStartTime(performance.now()); setCurrentAnalysis(null); };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">AI Plank Form Analyzer</h1>
          <p className="text-gray-600">Hold a strong plank and get real-time feedback</p>
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
              <h3 className="text-lg font-semibold mb-2">Hold Time</h3>
              <div className="text-5xl font-bold text-blue-600 mb-2">{currentAnalysis ? currentAnalysis.holdSeconds.toFixed(1) : '0.0'}s</div>
              <p className="text-sm text-gray-500">Continuous plank hold</p>
            </div>

            {currentAnalysis && (
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Form Analysis</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentAnalysis.overallForm === 'excellent' ? 'bg-blue-600 text-white' : 'bg-yellow-500 text-white'}`}>{currentAnalysis.overallForm.replace('-', ' ')}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center"><span className="text-sm">Straight Line</span><span className={`text-xs px-2 py-1 rounded-full ${currentAnalysis.straightLine ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{currentAnalysis.straightLine ? 'Good' : 'Arch/Pike'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm">Hip Position</span><span className={`text-xs px-2 py-1 rounded-full ${(!currentAnalysis.hipSag && !currentAnalysis.hipPike) ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{(!currentAnalysis.hipSag && !currentAnalysis.hipPike) ? 'Neutral' : (currentAnalysis.hipSag ? 'Sagging' : 'Piked')}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm">Shoulders Over Elbows</span><span className={`text-xs px-2 py-1 rounded-full ${currentAnalysis.shoulderOverElbow ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>{currentAnalysis.shoulderOverElbow ? 'Stacked' : 'Not stacked'}</span></div>
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
                <li className="flex items-start"><span className="text-blue-600 mr-2">2.</span>Start the analysis and hold a plank</li>
                <li className="flex items-start"><span className="text-blue-600 mr-2">3.</span>Follow the real-time feedback to adjust form</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlankAnalyzer;


