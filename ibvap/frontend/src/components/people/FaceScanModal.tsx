import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera as CameraIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  Shield,
  ArrowRight,
  Check,
} from 'lucide-react';
import { peopleApi } from '../../api/peopleApi';
import { FaceValidationResponse } from '../../types';
import { soundManager } from '../../utils/sound';

interface FaceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StepConfig {
  angle: string;
  name: string;
  instruction: string;
  hint: string;
}

const CAPTURE_STEPS: StepConfig[] = [
  { angle: 'FRONT', name: 'FRONT', instruction: 'Align face directly in reticle', hint: 'Look straight at optical sensor' },
  { angle: 'LEFT', name: 'LEFT', instruction: 'Turn head slightly LEFT (15°)', hint: 'Natural slight head rotation' },
  { angle: 'RIGHT', name: 'RIGHT', instruction: 'Turn head slightly RIGHT (15°)', hint: 'Natural slight head rotation' },
  { angle: 'LOOK_UP', name: 'UP', instruction: 'Tilt head slightly UP (10°)', hint: 'Look slightly above camera' },
  { angle: 'LOOK_DOWN', name: 'DOWN', instruction: 'Tilt head slightly DOWN (10°)', hint: 'Look slightly below camera' },
];

export const FaceScanModal: React.FC<FaceScanModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Step 1: info | Step 2: scan | Step 3: submitting
  const [currentStep, setCurrentStep] = useState<'info' | 'scan' | 'submitting'>('info');

  // Form Fields
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED'>('KNOWN');
  const [notes, setNotes] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  // Webcam & Capture Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);
  const [capturedSamples, setCapturedSamples] = useState<{ blob: Blob; url: string; angle: string }[]>([]);
  const [validation, setValidation] = useState<FaceValidationResponse | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [justCaptured, setJustCaptured] = useState(false);

  const isValidatingRef = useRef(false);
  const consecutiveValidRef = useRef(0);
  const autoCaptureCooldownRef = useRef(false);
  const faceHistoryRef = useRef<number[]>([]);

  // Start webcam
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(err.message || 'Camera access denied. Verify device permissions.');
    }
  }, []);

  // Stop webcam
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isValidatingRef.current = false;
    consecutiveValidRef.current = 0;
  }, []);

  useEffect(() => {
    if (isOpen && currentStep === 'scan') {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      stopWebcam();
    };
  }, [isOpen, currentStep, startWebcam, stopWebcam]);

  // Capture helper
  const captureCurrentPose = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
      setIsCapturing(true);
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));

      if (!blob) return;

      const currentAngle = CAPTURE_STEPS[currentAngleIdx]?.angle || 'FRONT';
      const url = URL.createObjectURL(blob);

      setJustCaptured(true);
      soundManager.playAlert('MEDIUM');
      setTimeout(() => setJustCaptured(false), 400);

      setCapturedSamples((prev) => [...prev, { blob, url, angle: currentAngle }]);

      consecutiveValidRef.current = 0;
      autoCaptureCooldownRef.current = true;
      setTimeout(() => {
        autoCaptureCooldownRef.current = false;
      }, 700);

      if (currentAngleIdx < CAPTURE_STEPS.length - 1) {
        setCurrentAngleIdx((prev) => prev + 1);
      }
    } catch {
      // ignore
    } finally {
      setIsCapturing(false);
    }
  }, [currentAngleIdx, isCapturing]);

  // Submit complete person registration
  const submitEnrollment = useCallback(
    async (samples: { blob: Blob; url: string; angle: string }[]) => {
      if (!name.trim()) {
        setErrorMessage('Full identity name is required');
        return;
      }
      if (samples.length === 0) {
        setErrorMessage('At least one biometric pose sample is required');
        return;
      }

      setErrorMessage(null);
      setCurrentStep('submitting');

      try {
        const blobs = samples.map((s) => s.blob);
        const angles = samples.map((s) => s.angle);

        await peopleApi.registerPerson(name.trim(), status, notes, blobs, angles, allowDuplicate);
        stopWebcam();
        soundManager.playAlert('HIGH');
        onSuccess();
        onClose();
      } catch (err: any) {
        setCurrentStep('scan');
        const detail = err.response?.data?.detail || err.message || 'Biometric enrollment failed';
        setErrorMessage(detail);
      }
    },
    [name, status, notes, allowDuplicate, stopWebcam, onSuccess, onClose]
  );

  // Auto-submit when all 5 poses are captured
  useEffect(() => {
    if (currentStep === 'scan' && capturedSamples.length === CAPTURE_STEPS.length && !isCapturing) {
      const timer = setTimeout(() => {
        submitEnrollment(capturedSamples);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [capturedSamples, currentStep, isCapturing, submitEnrollment]);

  // Validation loop
  useEffect(() => {
    if (!isOpen || currentStep !== 'scan') return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const checkAndAutoCapture = async () => {
      if (!isSubscribed || !videoRef.current || !canvasRef.current) return;
      if (isValidatingRef.current || autoCaptureCooldownRef.current || isCapturing) {
        timerId = setTimeout(checkAndAutoCapture, 300);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
        timerId = setTimeout(checkAndAutoCapture, 300);
        return;
      }

      try {
        isValidatingRef.current = true;
        canvas.width = 640;
        canvas.height = (video.videoHeight / video.videoWidth) * 640 || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));

        if (blob && isSubscribed) {
          const currentAngle = CAPTURE_STEPS[currentAngleIdx]?.angle || 'FRONT';
          const result = await peopleApi.validateFace(blob, currentAngle);

          if (isSubscribed) {
            faceHistoryRef.current = [...faceHistoryRef.current.slice(-2), result.faces_count];
            const ones = faceHistoryRef.current.filter((c) => c === 1).length;
            let smoothedCount = result.faces_count;
            if (ones >= 2) smoothedCount = 1;

            const smoothedResult = { ...result, faces_count: smoothedCount };
            setValidation(smoothedResult);

            if (smoothedResult.valid) {
              consecutiveValidRef.current += 1;
              if (consecutiveValidRef.current >= 2 && !autoCaptureCooldownRef.current) {
                captureCurrentPose();
              }
            } else {
              consecutiveValidRef.current = 0;
            }
          }
        }
      } catch {
        // Validation timeout
      } finally {
        isValidatingRef.current = false;
        if (isSubscribed && currentStep === 'scan') {
          timerId = setTimeout(checkAndAutoCapture, 250);
        }
      }
    };

    timerId = setTimeout(checkAndAutoCapture, 600);

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
    };
  }, [isOpen, currentStep, currentAngleIdx, captureCurrentPose, isCapturing]);

  if (!isOpen) return null;

  const currentPoseConfig = CAPTURE_STEPS[currentAngleIdx] || CAPTURE_STEPS[0];
  const progressPercent = (capturedSamples.length / CAPTURE_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-mono">
      <div className="bg-surface border border-surface-border rounded-lg w-full max-w-xl overflow-hidden shadow-tactical flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-tactical-blue" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              BIOMETRIC ENROLLMENT PROTOCOL
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-4 py-2 bg-surface-card border-b border-surface-border flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 ${currentStep === 'info' ? 'text-tactical-blue font-bold' : 'text-slate-500'}`}>
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]">01</span>
              <span>IDENTITY INFO</span>
            </div>
            <span className="text-surface-border">→</span>
            <div className={`flex items-center gap-1.5 ${currentStep === 'scan' ? 'text-tactical-blue font-bold' : 'text-slate-500'}`}>
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]">02</span>
              <span>OPTICAL POSES</span>
            </div>
            <span className="text-surface-border">→</span>
            <div className={`flex items-center gap-1.5 ${currentStep === 'submitting' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]">03</span>
              <span>1306-D ENROLLMENT</span>
            </div>
          </div>
          <span className="text-tactical-slate">POSE {capturedSamples.length}/{CAPTURE_STEPS.length}</span>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {errorMessage && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Info Form */}
          {currentStep === 'info' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) setCurrentStep('scan');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[10px] font-bold text-tactical-slate uppercase mb-1">
                  OFFICIAL IDENTITY NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ujjwal / Deepanshu Sinha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-tactical-slate uppercase mb-1">
                  SECURITY CLASSIFICATION *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('KNOWN')}
                    className={`py-2 px-3 rounded border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      status === 'KNOWN'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-emerald-glow'
                        : 'bg-surface-subtle border-surface-border text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    KNOWN (WHITELIST)
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('FLAGGED')}
                    className={`py-2 px-3 rounded border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      status === 'FLAGGED'
                        ? 'bg-red-950/40 border-red-500 text-red-400 shadow-alert-glow'
                        : 'bg-surface-subtle border-surface-border text-slate-400'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    FLAGGED (WATCHLIST)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-tactical-slate uppercase mb-1">
                  NOTES / CLEARANCE DESIGNATION
                </label>
                <input
                  type="text"
                  placeholder="e.g. Authorized Security Engineer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowDup"
                  checked={allowDuplicate}
                  onChange={(e) => setAllowDuplicate(e.target.checked)}
                  className="rounded border-surface-border bg-surface text-tactical-blue focus:ring-0 cursor-pointer"
                />
                <label htmlFor="allowDup" className="text-[10px] text-tactical-slate cursor-pointer">
                  Allow Duplicate Identity Override (Skip biometric conflict check)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded bg-surface-subtle text-slate-300 text-xs border border-surface-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-tactical-blue hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-tactical"
                >
                  Proceed to Optical Scanner <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Guided Scanner Viewport */}
          {currentStep === 'scan' && (
            <div className="space-y-3">
              {/* Progress Strip */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-tactical-slate mb-1">
                  <span>BIOMETRIC SAMPLING PROGRESS</span>
                  <span className="text-white font-bold">{capturedSamples.length} / {CAPTURE_STEPS.length} POSES</span>
                </div>
                <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden border border-surface-border">
                  <div
                    className="h-full bg-tactical-blue transition-all duration-300 shadow-tactical-glow"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Camera Scanner Container */}
              <div className="relative aspect-video bg-black rounded border border-surface-border overflow-hidden flex items-center justify-center tactical-reticle">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${justCaptured ? 'opacity-30' : 'opacity-100'} transition-opacity`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Optical Reticle Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-48 h-56 rounded-3xl border-2 transition-all ${
                      validation?.valid
                        ? 'border-emerald-400 shadow-emerald-glow'
                        : 'border-cyan-400/60'
                    }`}
                  >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white border border-slate-700 whitespace-nowrap">
                      {currentPoseConfig.instruction}
                    </div>
                  </div>
                </div>

                {/* Top Status */}
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/80 border border-surface-border text-[10px] text-tactical-cyan">
                  POSE: {currentPoseConfig.name}
                </div>

                {/* Error Banner */}
                {cameraError && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-black/90 text-center">
                    <AlertCircle className="w-6 h-6 text-red-400 mb-1" />
                    <div className="text-xs text-white font-bold">{cameraError}</div>
                  </div>
                )}
              </div>

              {/* Angle Samples Bar */}
              <div className="grid grid-cols-5 gap-1.5">
                {CAPTURE_STEPS.map((step, idx) => {
                  const captured = capturedSamples[idx];
                  const isCurrent = idx === currentAngleIdx && !captured;

                  return (
                    <div
                      key={step.angle}
                      className={`p-1 rounded text-center border text-[9px] ${
                        captured
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                          : isCurrent
                          ? 'bg-surface-elevated border-tactical-blue text-white'
                          : 'bg-surface-subtle border-surface-border text-tactical-slate'
                      }`}
                    >
                      <div className="font-bold">{step.name}</div>
                      <div className="text-[8px] mt-0.5">{captured ? '✓ SAVED' : isCurrent ? 'SCANNING' : 'PENDING'}</div>
                    </div>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="pt-2 flex items-center justify-between border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setCurrentStep('info')}
                  className="px-3 py-1.5 rounded bg-surface-subtle text-slate-300 text-xs border border-surface-border"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={captureCurrentPose}
                    disabled={isCapturing}
                    className="px-3.5 py-1.5 rounded bg-surface-elevated hover:bg-tactical-blue text-white text-xs font-bold border border-surface-border flex items-center gap-1.5"
                  >
                    <CameraIcon className="w-3.5 h-3.5" />
                    Manual Snapshot
                  </button>
                  {capturedSamples.length > 0 && (
                    <button
                      type="button"
                      onClick={() => submitEnrollment(capturedSamples)}
                      className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-tactical"
                    >
                      Enroll ({capturedSamples.length}) <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Submitting State */}
          {currentStep === 'submitting' && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-tactical-blue animate-spin" />
              <div className="text-sm font-bold text-white">GENERATING 1306-D BIOMETRIC DESCRIPTORS</div>
              <p className="text-xs text-tactical-slate max-w-sm mx-auto">
                Normalizing Sobel HOG, LBP, and facial projections. Committing encrypted feature vectors to repository...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
