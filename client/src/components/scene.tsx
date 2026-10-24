import {
    Environment,
} from "@react-three/drei";
import Character from "./character";
import {
    EffectComposer,
    Bloom,
} from "@react-three/postprocessing";
import { useTheme } from "../navigation/ThemeContext";

/** Props for the 3D WebGL Three.js Scene viewport. */
interface SceneProps {
    character?: string;
}

export default function Scene({ character = "koko" }: SceneProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const bgColor = isDark ? "#1A1C1C" : "#F5F5F3";

    return (
        <>
            {/* Background matching theme */}
            <color attach="background" args={[bgColor]} />

            {/* Depth fog matching background so ground blends seamlessly */}
            <fog attach="fog" args={[bgColor, 4, 12]} />

            <Environment
                preset={isDark ? "city" : "studio"}
                environmentIntensity={isDark ? 0.35 : 0.65}
            />

            {/* Soft global illumination */}
            <ambientLight intensity={isDark ? 0.55 : 0.85} />

            {/* Main light */}
            <directionalLight
                position={[2.5, 4, 4]}
                intensity={isDark ? 1.05 : 1.25}
            />

            {/* Fill */}
            <directionalLight
                position={[-3, 2, 2]}
                intensity={isDark ? 0.35 : 0.55}
            />

            {/* Rim */}
            <directionalLight
                position={[0, 4, -4]}
                intensity={isDark ? 0.45 : 0.35}
            />

            <Character characterId={character} />

            <EffectComposer>
                <Bloom
                    intensity={isDark ? 0.2 : 0.12}
                    luminanceThreshold={0.75}
                    luminanceSmoothing={0.9}
                />
            </EffectComposer>
        </>
    );
}