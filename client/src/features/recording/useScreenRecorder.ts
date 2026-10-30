import { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenRecorderManager } from './ScreenRecorderManager';
import type { RecordingState, RecordingResult } from './recording.types';

export const useScreenRecorder = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const pendingStreamRef = useRef<MediaStream | null>(null);
  const recorderManagerRef = useRef<ScreenRecorderManager | null>(null);

  // Initialize ScreenRecorderManager singleton
  if (!recorderManagerRef.current) {
    recorderManagerRef.current = new ScreenRecorderManager({
      onStateChange: (state) => {
        setRecordingState(state);
      },
      onError: (err) => {
        setRecordingError(err.message);
      },
      onAutoStopped: (result) => {
        setRecordingResult(result);
        setDownloadModalOpen(true);
      },
    });
  }

  // Elapsed duration timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Request start: triggers consent modal
  const requestStartRecording = useCallback((stream: MediaStream | null) => {
    if (!stream || stream.getVideoTracks().length === 0) {
      setRecordingError('You must share your screen before starting a screen recording.');
      return;
    }
    pendingStreamRef.current = stream;
    setConsentModalOpen(true);
  }, []);

  // Confirm start after explicit user consent
  const confirmStartRecording = useCallback(async () => {
    setConsentModalOpen(false);
    const stream = pendingStreamRef.current;
    if (!stream || !recorderManagerRef.current) return;

    try {
      setRecordingError(null);
      setDurationSeconds(0);
      setRecordingResult(null);
      await recorderManagerRef.current.start(stream);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start screen recorder';
      setRecordingError(msg);
    }
  }, []);

  const cancelConsent = useCallback(() => {
    setConsentModalOpen(false);
    pendingStreamRef.current = null;
  }, []);

  const pauseRecording = useCallback(() => {
    recorderManagerRef.current?.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    recorderManagerRef.current?.resume();
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recorderManagerRef.current) return null;
    try {
      const result = await recorderManagerRef.current.stop();
      setRecordingResult(result);
      setDownloadModalOpen(true);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop recording';
      setRecordingError(msg);
      return null;
    }
  }, []);

  const discardRecording = useCallback(() => {
    recorderManagerRef.current?.cleanup();
    setRecordingResult(null);
    setDownloadModalOpen(false);
    setDurationSeconds(0);
    setRecordingState('idle');
  }, []);

  const downloadRecording = useCallback(
    (customFileName?: string) => {
      if (!recordingResult?.blobUrl) return;

      const ext = recordingResult.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = customFileName || `meeting-screen-recording-${timestamp}.${ext}`;

      const link = document.createElement('a');
      link.href = recordingResult.blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [recordingResult]
  );

  // Teardown resources on unmount
  useEffect(() => {
    return () => {
      recorderManagerRef.current?.cleanup();
    };
  }, []);

  return {
    recordingState,
    durationSeconds,
    recordingResult,
    consentModalOpen,
    downloadModalOpen,
    recordingError,
    requestStartRecording,
    confirmStartRecording,
    cancelConsent,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    downloadRecording,
    setDownloadModalOpen,
  };
};
