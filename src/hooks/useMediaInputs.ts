import { useEffect, useState } from 'react';

export interface MediaInputs {
    video: HTMLVideoElement | null;
    audioAnalyser: AnalyserNode | null;
    audioContext: AudioContext | null;
    isReady: boolean;
    error: string | null;
}

export function useMediaInputs() {
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function setupMedia() {
            try {
                // 1. Video Stream (Webcam)
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, facingMode: 'user' },
                    audio: false, // We'll get audio separately to avoid feedback loops if needed, or just use this if we want mic
                });

                const videoEl = document.createElement('video');
                videoEl.srcObject = videoStream;
                videoEl.playsInline = true;
                videoEl.muted = true; // Mute to prevent feedback loop
                videoEl.loop = true;
                await videoEl.play();

                setVideo(videoEl);

                // 2. Audio Stream (Microphone)
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = audioCtx.createMediaStreamSource(audioStream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 512; // Resolution of frequency data
                source.connect(analyser);

                setAudioContext(audioCtx);
                setAudioAnalyser(analyser);
                setIsReady(true);

            } catch (err: any) {
                console.error("Error accessing media devices:", err);
                setError(err.message || "Could not access camera/microphone");
            }
        }

        setupMedia();

        return () => {
            // Cleanup tracks if needed, though usually we want them to persist while app is running
        };
    }, []);

    return { video, audioAnalyser, audioContext, isReady, error };
}
