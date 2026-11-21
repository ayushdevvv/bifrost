import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, OrbitControls, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'

function GlowRing({ position = [0, 0, 0], radius = 1, color = '#e879f9', opacity = 0.6 }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, 0.018, 12, 100]} />
    <meshBasicMaterial color={color} transparent opacity={opacity} />
  </mesh>
}

function Tower({ position, height = 1.4, color = '#ff5fa2', accent = '#a855f7', active = false }) {
  const glow = useRef()
  useFrame(({ clock }) => {
    if (glow.current) glow.current.material.opacity = (active ? 0.8 : 0.28) + Math.sin(clock.elapsedTime * 2.2) * 0.09
  })
  return <group position={position}>
    <mesh position={[0, height / 2, 0]} castShadow>
      <boxGeometry args={[0.72, height, 0.72]} />
      <meshStandardMaterial color="#101a30" metalness={0.75} roughness={0.28} emissive={color} emissiveIntensity={active ? 0.48 : 0.12} />
    </mesh>
    <mesh position={[0, height + 0.07, 0]}>
      <boxGeometry args={[0.78, 0.12, 0.78]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} metalness={0.4} />
    </mesh>
    <mesh ref={glow} position={[0, height + 0.28, 0]}>
      <sphereGeometry args={[0.12, 18, 18]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
    <GlowRing position={[0, 0.035, 0]} radius={0.68} color={color} />
  </group>
}

function AgentBot({ start = [0, 0.35, 0], target = [0, 0.35, 0], color = '#64d8ff', scale = 1 }) {
  const root = useRef()
  useFrame((state, delta) => {
    if (!root.current) return
    const dest = new THREE.Vector3(...target)
    root.current.position.lerp(dest, Math.min(1, delta * 1.7))
    root.current.position.y = dest.y + Math.sin(state.clock.elapsedTime * 2.1) * 0.08
    root.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.17
  })
  return <group ref={root} position={start} scale={scale}>
    <mesh position={[0, 0.28, 0]} castShadow>
      <capsuleGeometry args={[0.19, 0.3, 5, 12]} />
      <meshStandardMaterial color="#d9f2ff" metalness={0.72} roughness={0.2} />
    </mesh>
    <mesh position={[0, 0.69, 0]} castShadow>
      <sphereGeometry args={[0.29, 24, 24]} />
      <meshStandardMaterial color="#e7f6ff" metalness={0.78} roughness={0.18} />
    </mesh>
    <mesh position={[0, 0.7, 0.25]}>
      <sphereGeometry args={[0.19, 20, 20]} />
      <meshBasicMaterial color="#071526" />
    </mesh>
    {[-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0.72, 0.405]}>
      <sphereGeometry args={[0.035, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>)}
    <mesh position={[-0.32, 0.27, 0]} rotation={[0, 0, -0.28]}>
      <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
      <meshStandardMaterial color="#c8eaff" metalness={0.75} />
    </mesh>
    <mesh position={[0.32, 0.27, 0]} rotation={[0, 0, 0.28]}>
      <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
      <meshStandardMaterial color="#c8eaff" metalness={0.75} />
    </mesh>
    <GlowRing position={[0, -0.12, 0]} radius={0.5} color={color} opacity={0.7} />
  </group>
}

function NetworkPath({ points, color = '#4baeff', opacity = 0.45 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 48, 0.012, 6, false)
  }, [points])
  return <mesh geometry={geometry}>
    <meshBasicMaterial color={color} transparent opacity={opacity} />
  </mesh>
}

function Packet({ points, color = '#f0abfc', speed = 0.35, offset = 0 }) {
  const ref = useRef()
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.copy(curve.getPoint((clock.elapsedTime * speed + offset) % 1))
    ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6 + offset * 9) * 0.25)
  })
  return <mesh ref={ref}><sphereGeometry args={[0.075, 14, 14]} /><meshBasicMaterial color={color} /></mesh>
}

function ScanRing() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime * 0.45) % 1
    ref.current.scale.setScalar(0.6 + t * 2.6)
    ref.current.material.opacity = (1 - t) * 0.5
  })
  return <mesh ref={ref} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.96, 1, 96]} /><meshBasicMaterial color="#ff7ab8" transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
}

function Scene({ events = [], fault = 'none' }) {
  const latest = events[events.length - 1]
  const eventType = latest?.event_type || ''
  const targets = useMemo(() => {
    if (eventType.includes('provider')) return [[-2.4, 0.4, -1.65], [0.2, 0.4, 1.8]]
    if (eventType.includes('poison')) return [[2.2, 0.4, 1.85], [-0.4, 0.4, 1.8]]
    if (eventType.includes('latency')) return [[-2.1, 0.4, 1.6], [2.2, 0.4, -1.8]]
    if (eventType.includes('completed')) return [[0.2, 0.4, 0.2], [-0.2, 0.4, -0.25]]
    if (eventType.includes('tool')) return [[2.1, 0.4, 1.6], [-2.1, 0.4, 1.7]]
    return [[-0.3, 0.4, -0.6], [0.5, 0.4, 0.6]]
  }, [eventType, events.length])
  const providerDown = fault === 'provider' || eventType === 'provider.request.failed'
  const poisonActive = fault === 'poison' || eventType === 'evidence.poison.injected'
  const latencyActive = fault === 'latency' || eventType === 'latency.delay.applied'
  return <>
    <color attach="background" args={['#0a0618']} />
    <fog attach="fog" args={['#0a0618', 10, 25]} />
    <ambientLight intensity={0.75} />
    <directionalLight position={[4, 8, 5]} intensity={2} color="#c3e7ff" castShadow />
    <pointLight position={[0, 3, 0]} intensity={2.4} color="#d946ef" distance={11} />
    <pointLight position={[-4, 2, -2]} intensity={1.7} color="#ff5fa2" distance={8} />
    <pointLight position={[4, 2, 2]} intensity={1.5} color="#8b5cf6" distance={8} />
    <Stars radius={45} depth={22} count={850} factor={2.2} saturation={0.25} fade speed={0.5} />
    <Sparkles count={70} scale={[12, 5, 12]} size={1.6} speed={0.25} color="#63baff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#120a28" metalness={0.35} roughness={0.82} />
    </mesh>
    <gridHelper args={[24, 48, '#5b2a8c', '#2a1250']} position={[0, -0.105, 0]} />
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.2, 2.5, 0.38, 64]} />
        <meshStandardMaterial color="#101b33" metalness={0.82} roughness={0.25} emissive="#102c57" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[1.5, 1.8, 0.18, 64]} />
        <meshStandardMaterial color="#162a4b" metalness={0.86} roughness={0.2} emissive="#125caa" emissiveIntensity={0.55} />
      </mesh>
      <GlowRing position={[0, 0.34, 0]} radius={2.28} color="#ff7ab8" opacity={0.9} />
      <GlowRing position={[0, 0.45, 0]} radius={1.62} color="#a855f7" opacity={0.78} />
      <Float speed={1.1} rotationIntensity={0.04} floatIntensity={0.16}>
        <mesh position={[0, 1.7, 0]}>
          <octahedronGeometry args={[0.72, 1]} />
          <meshPhysicalMaterial color="#e879f9" roughness={0.1} metalness={0.5} transmission={0.55} thickness={1.4} emissive="#155b9f" emissiveIntensity={0.55} />
        </mesh>
      </Float>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.34, 0.44, 0.7, 32]} />
        <meshStandardMaterial color="#d9f4ff" metalness={0.85} roughness={0.2} emissive="#35a9ff" emissiveIntensity={0.25} />
      </mesh>
    </group>
    <Tower position={[-3.3, 0, -2.1]} height={1.7} color={providerDown ? '#ff526f' : '#5eaaff'} accent={providerDown ? '#a72f51' : '#3d79ff'} active={providerDown} />
    <Tower position={[3.3, 0, -2.1]} height={1.95} color="#1ed8c1" accent="#168c91" active={false} />
    <Tower position={[3.25, 0, 2.1]} height={1.45} color={poisonActive ? '#bd67ff' : '#8c70ff'} accent={poisonActive ? '#a341d9' : '#684bd9'} active={poisonActive} />
    <Tower position={[-3.3, 0, 2.15]} height={1.3} color={latencyActive ? '#ffcb68' : '#38c7ff'} accent={latencyActive ? '#ba7e25' : '#247cb9'} active={latencyActive} />
    <NetworkPath points={[[-3.3, 0.16, -2.1], [-1.3, 0.4, -1], [0, 0.45, 0]]} color={providerDown ? '#ff526f' : '#4b9cff'} />
    <NetworkPath points={[[0, 0.44, 0], [1.7, 0.35, 0.8], [3.25, 0.16, 2.1]]} color={poisonActive ? '#be6aff' : '#21d6c0'} />
    <NetworkPath points={[[-3.3, 0.16, 2.15], [-1.5, 0.38, 1.2], [0, 0.45, 0]]} color={latencyActive ? '#ffc75f' : '#399de9'} opacity={latencyActive ? 0.9 : 0.45} />
    <ScanRing />
    <Packet points={[[-3.3, 0.16, -2.1], [-1.3, 0.4, -1], [0, 0.45, 0]]} color={providerDown ? '#ff7a8f' : '#f0abfc'} speed={providerDown ? 0.12 : 0.32} />
    <Packet points={[[0, 0.44, 0], [1.7, 0.35, 0.8], [3.25, 0.16, 2.1]]} color={poisonActive ? '#d9a0ff' : '#ff8cc3'} offset={0.4} />
    <Packet points={[[-3.3, 0.16, 2.15], [-1.5, 0.38, 1.2], [0, 0.45, 0]]} color={latencyActive ? '#ffd98a' : '#c4a1ff'} speed={latencyActive ? 0.1 : 0.3} offset={0.7} />
    <AgentBot start={[-0.35, 0.5, -0.45]} target={targets[0]} color="#64d8ff" scale={0.82} />
    <AgentBot start={[0.45, 0.5, 0.45]} target={targets[1]} color="#c58cff" scale={0.72} />
    <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={12} blur={2.8} far={4} />
    <OrbitControls enablePan={false} minDistance={6} maxDistance={15} maxPolarAngle={1.34} minPolarAngle={0.55} autoRotate autoRotateSpeed={0.22} />
  </>
}

export default function Arena3D({ events = [], fault = 'none', paused = false, className = '' }) {
  return <div className={`arena-canvas ${className}`}>
    <Canvas shadows frameloop={paused ? 'never' : 'always'} dpr={[1, 1.6]} camera={{ position: [8.4, 7.4, 9.2], fov: 38 }} fallback={<div className="canvas-fallback">WebGL is unavailable in this browser.</div>}>
      <Scene events={events} fault={fault} />
    </Canvas>
  </div>
}
