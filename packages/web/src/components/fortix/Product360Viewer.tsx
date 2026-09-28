import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

interface Product360ViewerProps {
  modelUrl?: string; // Will eventually be the URL to your 3D models (.glb / .gltf)
  fallbackImageUrl?: string;
}

// Temporary fallback geometry if no 3D model is provided yet
function PlaceholderGeometry() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.5, 3, 0.2]} />
      <meshStandardMaterial color="#1A1A1A" roughness={0.2} metalness={0.8} />
    </mesh>
  );
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function Product360Viewer({ modelUrl }: Product360ViewerProps) {
  return (
    <div className="w-full h-full min-h-[400px] bg-[#0A0A0A] rounded-2xl relative cursor-grab active:cursor-grabbing overflow-hidden border border-white/5">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.29 7 12 12 20.71 7"/>
          <line x1="12" y1="22" x2="12" y2="12"/>
        </svg>
        360° Interactive
      </div>
      
      <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-[var(--text-muted)]">3D Viewer Unavailable</div>}>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 4], fov: 45 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.5} adjustCamera={1.2}>
              {modelUrl ? <Model url={modelUrl} /> : <PlaceholderGeometry />}
            </Stage>
          </Suspense>
          <OrbitControls 
            autoRotate 
            autoRotateSpeed={1} 
            enableZoom={false} 
            makeDefault 
            minPolarAngle={Math.PI / 3} 
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
