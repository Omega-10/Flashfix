import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Float, useGLTF } from "@react-three/drei";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Sun, Sunset, Moon, Sparkles, RefreshCcw } from "lucide-react";

interface Product360ViewerProps {
  modelUrl?: string;
  fallbackImageUrl?: string;
}

type LightingPreset = "studio" | "daylight" | "sunset" | "night";

interface LightingConfig {
  id: LightingPreset;
  label: string;
  icon: typeof Sun;
  environment: "studio" | "city" | "sunset" | "night";
  ambientLight: number;
  stageIntensity: number;
  bgGlow: string;
  bgStyle: string;
}

const LIGHTING_MODES: Record<LightingPreset, LightingConfig> = {
  studio: {
    id: "studio",
    label: "Studio",
    icon: Sparkles,
    environment: "studio",
    ambientLight: 1.4,
    stageIntensity: 0.9,
    bgGlow: "rgba(255, 255, 255, 0.12)",
    bgStyle: "radial-gradient(circle at center, rgba(239, 143, 11, 0.08) 0%, rgba(255, 255, 255, 0.03) 40%, transparent 70%)",
  },
  daylight: {
    id: "daylight",
    label: "Daylight",
    icon: Sun,
    environment: "city",
    ambientLight: 1.8,
    stageIntensity: 1.1,
    bgGlow: "rgba(56, 189, 248, 0.15)",
    bgStyle: "radial-gradient(circle at center, rgba(56, 189, 248, 0.12) 0%, rgba(239, 143, 11, 0.05) 50%, transparent 75%)",
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    icon: Sunset,
    environment: "sunset",
    ambientLight: 1.5,
    stageIntensity: 1.0,
    bgGlow: "rgba(249, 115, 22, 0.2)",
    bgStyle: "radial-gradient(circle at center, rgba(249, 115, 22, 0.18) 0%, rgba(239, 143, 11, 0.08) 45%, transparent 70%)",
  },
  night: {
    id: "night",
    label: "Night",
    icon: Moon,
    environment: "night",
    ambientLight: 0.6,
    stageIntensity: 0.6,
    bgGlow: "rgba(99, 102, 241, 0.15)",
    bgStyle: "radial-gradient(circle at center, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.2) 60%, transparent 80%)",
  },
};

// Refined engineered case placeholder with sleek metallic and protective bezel details
function PlaceholderCaseGeometry({ isLight }: { isLight: boolean }) {
  return (
    <group>
      {/* Main Body Chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 3.1, 0.18]} />
        <meshStandardMaterial
          color={isLight ? "#C5C0B8" : "#2A2A2A"}
          roughness={0.15}
          metalness={0.85}
        />
      </mesh>

      {/* Screen / Protection Surface */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[1.38, 2.96]} />
        <meshStandardMaterial
          color={isLight ? "#E5E1DB" : "#111111"}
          roughness={0.05}
          metalness={0.95}
        />
      </mesh>

      {/* Camera Module Island */}
      <mesh position={[0.38, 0.95, -0.1]} castShadow>
        <boxGeometry args={[0.55, 0.8, 0.08]} />
        <meshStandardMaterial
          color="#ef8f0b"
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>

      {/* Accent Brand Ring */}
      <mesh position={[0, -0.1, -0.095]}>
        <ringGeometry args={[0.32, 0.35, 32]} />
        <meshStandardMaterial
          color="#ef8f0b"
          emissive="#ef8f0b"
          emissiveIntensity={0.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function Product360Viewer({ modelUrl }: Product360ViewerProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeLighting, setActiveLighting] = useState<LightingPreset>("studio");

  useEffect(() => {
    const isLight = document.documentElement.classList.contains("light");
    setTheme(isLight ? "light" : "dark");

    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const config = LIGHTING_MODES[activeLighting];
  const isLight = theme === "light";

  return (
    <div className="w-full h-full min-h-[460px] bg-[var(--surface-bg)] rounded-3xl relative cursor-grab active:cursor-grabbing overflow-hidden border border-[var(--surface-border)] select-none">
      
      {/* ── Dynamic Natural Lighting Background (Confined to 360 viewer) ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: config.bgStyle,
          opacity: isLight ? 0.9 : 0.6,
        }}
      />

      {/* ── Top Header Controls ── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Badge */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] font-mono bg-[var(--surface-elevated)]/85 px-3 py-1.5 rounded-full backdrop-blur-md border border-[var(--surface-border)] shadow-sm pointer-events-auto">
          <RefreshCcw className="w-3.5 h-3.5 text-[#ef8f0b] animate-spin" style={{ animationDuration: "12s" }} />
          <span>360° Interactive View</span>
        </div>

        {/* Ambient / Theme Indicator */}
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] hidden sm:inline-block">
          Drag to Rotate
        </span>
      </div>

      {/* ── Lighting Preset Selector (Confined Controls) ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[var(--surface-elevated)]/90 backdrop-blur-md border border-[var(--surface-border)] p-1.5 rounded-full shadow-lg">
        {(Object.keys(LIGHTING_MODES) as LightingPreset[]).map((modeKey) => {
          const item = LIGHTING_MODES[modeKey];
          const Icon = item.icon;
          const isActive = activeLighting === modeKey;

          return (
            <button
              key={modeKey}
              onClick={() => setActiveLighting(modeKey)}
              aria-label={`Switch lighting to ${item.label}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive
                  ? "bg-[#ef8f0b] text-black shadow-md font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)]/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 3D Viewport ── */}
      <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-[var(--text-muted)] text-sm">3D Scene Loaded</div>}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 4.2], fov: 45 }}
          className="w-full h-full"
        >
          {/* Dynamic Ambient Light: boosted for light mode to prevent silhouette */}
          <ambientLight intensity={isLight ? config.ambientLight * 1.3 : config.ambientLight} />

          {/* Directional Key Light with soft shadows */}
          <directionalLight
            position={[5, 8, 5]}
            intensity={isLight ? 1.4 : 0.9}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />

          <Suspense fallback={null}>
            <Stage
              environment={config.environment}
              intensity={isLight ? config.stageIntensity * 1.2 : config.stageIntensity}
              adjustCamera={1.15}
              shadows={{ type: "contact", opacity: isLight ? 0.4 : 0.7, blur: 2 }}
            >
              <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
                {modelUrl ? <Model url={modelUrl} /> : <PlaceholderCaseGeometry isLight={isLight} />}
              </Float>
            </Stage>
          </Suspense>

          <OrbitControls
            autoRotate
            autoRotateSpeed={1.2}
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
