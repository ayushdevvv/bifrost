import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

export const ARENA_NODES = [
  { id: 'llm', label: 'LLM Provider', pos: [-3.3, 0, -2.7] },
  { id: 'bifrost', label: 'Bifrost Gateway', pos: [3.3, 0, -2.7] },
  { id: 'browser', label: 'Browser / Tavily', pos: [-4.6, 0, 0.7] },
  { id: 'api', label: 'API Gateway', pos: [4.6, 0, 0.7] },
  { id: 'db', label: 'Database', pos: [-2.1, 0, 3.5] },
  { id: 'tools', label: 'External Tools', pos: [2.1, 0, 3.5] },
]
export const nodeForEvent = (type = '') => {
  if (/fallback/.test(type)) return 'bifrost'
  if (/provider|model/.test(type)) return 'llm'
  if (/research|search|poison|evidence/.test(type)) return 'browser'
  if (/latency/.test(type)) return 'api'
  if (/memory/.test(type)) return 'db'
  if (/tool/.test(type)) return 'tools'
  return 'bifrost'
}
export const scenarioForEvent = (type = '') => /provider.*fail|provider\.request\.failed/.test(type) ? 'provider' : /poison/.test(type) ? 'poison' : /latency/.test(type) ? 'latency' : /tool.*(fail|unavailable)/.test(type) ? 'tool' : /fallback\.completed/.test(type) ? 'recovery' : 'normal'
const AFFECTED = { provider: ['llm', 'bad'], poison: ['browser', 'poison'], latency: ['api', 'warn'], tool: ['tools', 'bad'], recovery: ['bifrost', 'ok'] }
export const nodeHealth = (id, scenario) => (AFFECTED[scenario]?.[0] === id ? AFFECTED[scenario][1] : 'ok')
export const HEALTH_COLOR = { ok: '#22d3ee', warn: '#fbbf24', bad: '#fb7185', poison: '#c084fc' }
export const HEALTH_LABEL = { ok: 'HEALTHY', warn: 'SLOW', bad: 'DOWN', poison: 'POISONED' }
const CENTER_Y = 0.55

function Ring({ r = 1, y = 0, color = '#22d3ee', opacity = 0.7, tube = 0.015, spin = 0 }) {
  const ref = useRef()
  useFrame((_, d) => { if (ref.current && spin) ref.current.rotation.z += d * spin })
  return <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[r, tube, 10, 96]} /><meshBasicMaterial color={color} transparent opacity={opacity} /></mesh>
}

function Core({ scenario }) {
  const body = useRef()
  const bad = scenario === 'provider' || scenario === 'tool'
  useFrame(({ clock }) => { if (body.current) { body.current.position.y = 1.05 + Math.sin(clock.elapsedTime * 1.6) * 0.06; body.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.25 } })
  const c = bad ? '#fb7185' : '#22d3ee'
  return <group>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[1.5, 1.75, 0.24, 64]} /><meshStandardMaterial color="#071a28" metalness={0.8} roughness={0.3} emissive="#06475a" emissiveIntensity={0.6} /></mesh>
    <Ring r={1.55} y={0.26} color={c} opacity={0.95} tube={0.025} spin={0.6} />
    <Ring r={1.05} y={0.28} color="#5eead4" opacity={0.8} spin={-0.9} />
    <Ring r={0.55} y={0.3} color={c} opacity={0.9} tube={0.03} />
    <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[1.0, 1.0, 2.5, 48, 1, true]} /><meshPhysicalMaterial color="#38e1ff" transparent opacity={0.1} roughness={0.05} side={THREE.DoubleSide} emissive="#0891b2" emissiveIntensity={0.35} /></mesh>
    <group ref={body} position={[0, 1.05, 0]}>
      <mesh position={[0, 0.2, 0]}><capsuleGeometry args={[0.3, 0.6, 6, 16]} /><meshStandardMaterial color="#cdeffb" metalness={0.75} roughness={0.22} emissive="#0e7490" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.95, 0]}><sphereGeometry args={[0.34, 24, 24]} /><meshStandardMaterial color="#e6f9ff" metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[0, 0.97, 0.26]}><boxGeometry args={[0.46, 0.14, 0.12]} /><meshBasicMaterial color={c} /></mesh>
      <mesh position={[0, 0.25, 0.3]}><octahedronGeometry args={[0.1]} /><meshBasicMaterial color={c} /></mesh>
    </group>
    <Html position={[0, 0.02, 1.9]} center distanceFactor={9} zIndexRange={[5, 0]}><div className="a3d-tag core">ATLAS-01<small>{bad ? 'RECOVERING' : 'EXECUTING TASK'}</small></div></Html>
  </group>
}

function Node({ node, health, active, selected, onSelect }) {
  const glow = useRef()
  const color = HEALTH_COLOR[health]
  useFrame(({ clock }) => { if (glow.current) glow.current.material.opacity = (active ? 0.9 : 0.4) + Math.sin(clock.elapsedTime * 3 + node.pos[0]) * 0.12 })
  return <group position={node.pos} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
    <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.62, 0.7, 0.2, 40]} /><meshStandardMaterial color="#071a28" metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={active ? 0.5 : 0.15} /></mesh>
    <mesh ref={glow} position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.025, 8, 48]} /><meshBasicMaterial color={color} transparent opacity={0.6} /></mesh>
    <mesh position={[0, 0.72, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#0b2a3c" metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={selected ? 0.9 : 0.4} /></mesh>
    {selected && <Ring r={0.85} y={0.05} color="#ffffff" opacity={0.9} tube={0.02} spin={1.2} />}
    <Html position={[0, 1.35, 0]} center distanceFactor={9} zIndexRange={[5, 0]}><div className={`a3d-tag ${health}`}>{node.label}<small>{HEALTH_LABEL[health]}</small></div></Html>
  </group>
}

function Link({ to, color, active }) {
  const ref = useRef()
  const pts = useMemo(() => [[0, CENTER_Y, 0], [to[0] * 0.5, CENTER_Y + 0.6, to[2] * 0.5], [to[0], 0.7, to[2]]], [to])
  useFrame((_, d) => { if (ref.current?.material) ref.current.material.dashOffset -= d * (active ? 1.6 : 0.5) })
  return <Line ref={ref} points={pts} color={color} lineWidth={active ? 2.4 : 1.2} dashed dashSize={0.22} gapSize={0.16} transparent opacity={active ? 0.95 : 0.4} />
}

function Packet({ to, color, speed = 0.55, offset = 0, reverse = false }) {
  const ref = useRef()
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, CENTER_Y, 0), new THREE.Vector3(to[0] * 0.5, CENTER_Y + 0.6, to[2] * 0.5), new THREE.Vector3(to[0], 0.7, to[2])), [to])
  useFrame(({ clock }) => {
    if (!ref.current) return
    let t = (clock.elapsedTime * speed + offset) % 1
    if (reverse) t = 1 - t
    ref.current.position.copy(curve.getPoint(t))
    ref.current.scale.setScalar(0.8 + Math.sin(t * Math.PI) * 0.7)
  })
  return <mesh ref={ref}><sphereGeometry args={[0.09, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
}

function Scene({ scenario, activeId, selectedId, onSelect }) {
  return <>
    <color attach="background" args={['#030b14']} />
    <fog attach="fog" args={['#030b14', 12, 28]} />
    <ambientLight intensity={0.55} />
    <pointLight position={[0, 4, 0]} intensity={3} color="#22d3ee" distance={14} />
    <pointLight position={[-5, 3, 3]} intensity={1.4} color="#2dd4bf" distance={10} />
    <pointLight position={[5, 3, -3]} intensity={1.2} color="#38bdf8" distance={10} />
    <Sparkles count={90} scale={[14, 5, 12]} size={1.8} speed={0.3} color="#67e8f9" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#04101a" metalness={0.5} roughness={0.7} /></mesh>
    <gridHelper args={[30, 60, '#0e7490', '#0a2a3a']} position={[0, 0, 0]} />
    <Core scenario={scenario} />
    {ARENA_NODES.map((n) => {
      const h = nodeHealth(n.id, scenario); const active = n.id === activeId
      const col = HEALTH_COLOR[h]
      return <group key={n.id}>
        <Link to={n.pos} color={col} active={active} />
        <Packet to={n.pos} color={col} offset={(n.pos[0] + 5) / 11} speed={active ? 0.9 : 0.35} reverse={n.id === 'llm' || n.id === 'db'} />
        {active && <Packet to={n.pos} color="#ffffff" offset={0.5} speed={0.9} />}
        <Node node={n} health={h} active={active} selected={n.id === selectedId} onSelect={onSelect} />
      </group>
    })}
    <OrbitControls enablePan={false} minDistance={7} maxDistance={16} maxPolarAngle={1.35} minPolarAngle={0.35} autoRotate autoRotateSpeed={0.25} target={[0, 0.8, 0.3]} />
  </>
}

export default function Arena3D({ scenario = 'normal', activeId = 'bifrost', selectedId = null, onSelect = () => {}, paused = false, className = '' }) {
  return <div className={`arena-canvas ${className}`}>
    <Canvas frameloop={paused ? 'never' : 'always'} dpr={[1, 1.6]} camera={{ position: [0, 5.6, 10.5], fov: 40 }} onPointerMissed={() => onSelect(null)} fallback={<div className="canvas-fallback">WebGL is unavailable in this browser.</div>}>
      <Scene scenario={scenario} activeId={activeId} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  </div>
}
