import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls, folder } from 'leva';
import { vertexShader, fragmentShader } from '../shaders/particles';

interface VisualizerProps {
    video: HTMLVideoElement;
    audioAnalyser: AnalyserNode;
}

export function Visualizer({ video, audioAnalyser }: VisualizerProps) {
    const pointsRef = useRef<THREE.Points>(null);
    const videoTextureRef = useRef<THREE.VideoTexture | null>(null);
    const bgPlaneRef = useRef<THREE.Mesh>(null);

    // Audio smoothing refs
    const audioLevels = useRef({ low: 0, mid: 0, high: 0 });

    // Controls
    const {
        mode,
        colorMode,
        particleSize,
        displacementStrength,
        showOverlay,
        overlayOpacity,
        contrast,
        brightness,
        minDepth,
        maxDepth,
        audioGain,
        audioSmoothing
    } = useControls({
        'General': folder({
            mode: { options: { Classic: 0, Wave: 1, Glitch: 2, Vortex: 3, Rain: 4 }, value: 0 },
            colorMode: { options: { Original: 0, Cyberpunk: 1, Heatmap: 2, Neon: 3 }, value: 0 },
            particleSize: { value: 4.0, min: 1.0, max: 30.0 },
            displacementStrength: { value: 2.0, min: 0.0, max: 20.0 },
        }),
        'Video Adjustments': folder({
            contrast: { value: 1.0, min: 0.0, max: 3.0 },
            brightness: { value: 0.0, min: -1.0, max: 1.0 },
            showOverlay: { value: false },
            overlayOpacity: { value: 0.5, min: 0.0, max: 1.0 }
        }),
        'Depth Simulation': folder({
            minDepth: { value: 0.0, min: 0.0, max: 1.0, label: 'Near Clip' },
            maxDepth: { value: 1.0, min: 0.0, max: 1.0, label: 'Far Clip' },
        }),
        'Audio Response': folder({
            audioGain: { value: 1.0, min: 0.0, max: 5.0 },
            audioSmoothing: { value: 0.8, min: 0.0, max: 0.99, label: 'Damping' },
        })
    });

    // Initialize Video Texture
    useEffect(() => {
        if (!video) return;
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        videoTextureRef.current = texture;
    }, [video]);

    // Create Geometry (Grid of points)
    const geometry = useMemo(() => {
        // Grid resolution
        const cols = 320;
        const rows = 180;
        const count = cols * rows;

        const positions = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 2);

        for (let i = 0; i < count; i++) {
            const x = (i % cols) / cols;
            const y = Math.floor(i / cols) / rows;

            // Center the grid
            positions[i * 3] = (x - 0.5) * 16; // Aspect ratio approx 16:9
            positions[i * 3 + 1] = (y - 0.5) * 9; // Flip Y if needed
            positions[i * 3 + 2] = 0;

            uvs[i * 2] = x;
            uvs[i * 2 + 1] = y;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return geo;
    }, []);

    // Shader Uniforms
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uTexture: { value: null },
        uAudioHigh: { value: 0 },
        uAudioMid: { value: 0 },
        uAudioLow: { value: 0 },
        uDisplacementStrength: { value: 0 },
        uParticleSize: { value: 0 },
        uMode: { value: 0 },
        uColorMode: { value: 0 },
        uContrast: { value: 1 },
        uBrightness: { value: 0 },
        uMinDepth: { value: 0 },
        uMaxDepth: { value: 1 }
    }), []);

    // Audio Data Array
    const audioDataArray = useMemo(() => new Uint8Array(audioAnalyser.frequencyBinCount), [audioAnalyser]);

    useFrame((state) => {
        if (!pointsRef.current || !videoTextureRef.current) return;

        // Update Audio Data
        audioAnalyser.getByteFrequencyData(audioDataArray);

        // Calculate simple bands
        const lowEnd = Math.floor(audioDataArray.length * 0.1);
        const midEnd = Math.floor(audioDataArray.length * 0.4);

        let lowSum = 0, midSum = 0, highSum = 0;
        for (let i = 0; i < lowEnd; i++) lowSum += audioDataArray[i];
        for (let i = lowEnd; i < midEnd; i++) midSum += audioDataArray[i];
        for (let i = midEnd; i < audioDataArray.length; i++) highSum += audioDataArray[i];

        const rawLow = (lowSum / lowEnd / 255) * audioGain;
        const rawMid = (midSum / (midEnd - lowEnd) / 255) * audioGain;
        const rawHigh = (highSum / (audioDataArray.length - midEnd) / 255) * audioGain;

        // Apply Smoothing (Damping)
        // lerp(current, target, 1 - smoothing)
        // If smoothing is 0.9, we move 10% towards target per frame (slow)
        // If smoothing is 0.0, we move 100% towards target (instant)
        const factor = 1.0 - audioSmoothing;
        audioLevels.current.low = THREE.MathUtils.lerp(audioLevels.current.low, rawLow, factor);
        audioLevels.current.mid = THREE.MathUtils.lerp(audioLevels.current.mid, rawMid, factor);
        audioLevels.current.high = THREE.MathUtils.lerp(audioLevels.current.high, rawHigh, factor);

        // Update Uniforms
        const mat = pointsRef.current.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = state.clock.elapsedTime;
        mat.uniforms.uTexture.value = videoTextureRef.current;

        mat.uniforms.uAudioLow.value = audioLevels.current.low;
        mat.uniforms.uAudioMid.value = audioLevels.current.mid;
        mat.uniforms.uAudioHigh.value = audioLevels.current.high;

        mat.uniforms.uDisplacementStrength.value = displacementStrength;
        mat.uniforms.uParticleSize.value = particleSize;
        mat.uniforms.uMode.value = mode;
        mat.uniforms.uColorMode.value = colorMode;

        mat.uniforms.uContrast.value = contrast;
        mat.uniforms.uBrightness.value = brightness;
        mat.uniforms.uMinDepth.value = minDepth;
        mat.uniforms.uMaxDepth.value = maxDepth;

        // Update Background Plane if visible
        if (bgPlaneRef.current) {
            bgPlaneRef.current.visible = showOverlay;
            (bgPlaneRef.current.material as THREE.MeshBasicMaterial).map = videoTextureRef.current;
            (bgPlaneRef.current.material as THREE.MeshBasicMaterial).opacity = overlayOpacity;
        }
    });

    return (
        <group>
            {/* Particles */}
            <points ref={pointsRef} geometry={geometry}>
                <shaderMaterial
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    uniforms={uniforms}
                    transparent={true}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* Background Overlay Plane */}
            <mesh ref={bgPlaneRef} position={[0, 0, -5]} scale={[16, 9, 1]}>
                <planeGeometry />
                <meshBasicMaterial transparent={true} opacity={0.5} />
            </mesh>
        </group>
    );
}
