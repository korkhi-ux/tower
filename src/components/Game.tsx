import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/Engine';
import { Hex, hexToPixel, pixelToHex, hexToString, hexRound } from '../game/HexMath';
import { TOWER_STATS, TowerType, ENEMY_STATS } from '../game/Types';
import { Shield, Zap, Crosshair, Coins, Play, RotateCcw, Hammer, ArrowUpCircle, Trash2 } from 'lucide-react';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameEngine['state'] | null>(null);
  const [hoverHex, setHoverHex] = useState<Hex | null>(null);
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [buildMode, setBuildMode] = useState<TowerType | null>(null);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const hoverHexRef = useRef<Hex | null>(null);
  const selectedHexRef = useRef<Hex | null>(null);
  const buildModeRef = useRef<TowerType | null>(null);
  const selectedEnemyIdRef = useRef<string | null>(null);

  useEffect(() => {
    hoverHexRef.current = hoverHex;
  }, [hoverHex]);

  useEffect(() => {
    selectedHexRef.current = selectedHex;
  }, [selectedHex]);

  useEffect(() => {
    buildModeRef.current = buildMode;
  }, [buildMode]);

  useEffect(() => {
    selectedEnemyIdRef.current = selectedEnemyId;
  }, [selectedEnemyId]);

  // Initialize engine
  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    
    const newEngine = new GameEngine(clientWidth, clientHeight);
    newEngine.onStateChange = setGameState;
    setEngine(newEngine);
    setGameState(newEngine.state);

    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      // Cap dt to prevent huge jumps if tab is inactive
      if (dt < 0.1) {
        newEngine.update(dt);
      }
      
      render(newEngine);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const render = (eng: GameEngine) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time = performance.now();

    // Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Draw Grid (Background)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const radius = 10;
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const hex = { q, r, s: -q - r };
        // Fade out grid towards edges
        const pos = hexToPixel(hex, eng.hexSize);
        const distFromCenter = Math.sqrt(pos.x*pos.x + pos.y*pos.y);
        const maxDist = Math.min(canvas.width, canvas.height) / 1.5;
        const alpha = Math.max(0, 1 - distFromCenter / maxDist);
        
        if (alpha > 0) {
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.08 * alpha})`;
          drawHex(ctx, hex, eng.hexSize, cx, cy, false);
        }
      }
    }

    // Draw Path
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    eng.paths.forEach((path, pathIdx) => {
      path.forEach((hex, i) => {
        drawHex(ctx, hex, eng.hexSize, cx, cy, true, i === 0 ? 'rgba(255, 0, 255, 0.2)' : i === path.length - 1 ? 'rgba(0, 255, 255, 0.2)' : undefined);
      });
    });

    // Draw Base Core
    if (eng.paths.length > 0 && eng.paths[0].length > 0) {
      const baseHex = eng.paths[0][eng.paths[0].length - 1];
      const basePos = hexToPixel(baseHex, eng.hexSize);
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 20 + Math.sin(time / 200) * 10;
      ctx.beginPath();
      ctx.arc(basePos.x + cx, basePos.y + cy, eng.hexSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(basePos.x + cx, basePos.y + cy, eng.hexSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Enemy Pathing
    const currentSelectedEnemyId = selectedEnemyIdRef.current;
    if (currentSelectedEnemyId) {
      const enemy = eng.state.enemies.find(e => e.id === currentSelectedEnemyId);
      if (enemy) {
        const targetHex = eng.paths[enemy.pathId][enemy.pathIndex + 1];
        if (targetHex) {
          const targetPos = hexToPixel(targetHex, eng.hexSize);
          const tx = targetPos.x + cx;
          const ty = targetPos.y + cy;

          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          drawHex(ctx, targetHex, eng.hexSize, cx, cy, true, 'rgba(255, 170, 0, 0.3)');
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 2;
          drawHex(ctx, targetHex, eng.hexSize, cx, cy, false);
        }
      }
    }

    // Draw Hover/Selected
    const currentHoverHex = hoverHexRef.current;
    const currentSelectedHex = selectedHexRef.current;
    const currentBuildMode = buildModeRef.current;

    if (currentHoverHex) {
      let isValid = true;
      if (currentBuildMode) {
        const hexStr = hexToString(currentHoverHex);
        const isOnPath = eng.paths.some(p => p.some(h => hexToString(h) === hexStr));
        const isOccupied = eng.state.towers.some(t => hexToString(t.hex) === hexStr);
        const canAfford = eng.state.credits >= TOWER_STATS[currentBuildMode].cost;
        isValid = !isOnPath && !isOccupied && canAfford;
      }
      
      const hoverColor = currentBuildMode 
        ? (isValid ? TOWER_STATS[currentBuildMode].color : '#ff0033') 
        : 'rgba(255, 255, 255, 0.5)';

      ctx.strokeStyle = hoverColor;
      ctx.lineWidth = 2;
      drawHex(ctx, currentHoverHex, eng.hexSize, cx, cy, false, currentBuildMode ? (isValid ? `${hoverColor}33` : 'rgba(255,0,51,0.2)') : undefined);
      
      // Draw range indicator if building
      if (currentBuildMode && isValid) {
        const pos = hexToPixel(currentHoverHex, eng.hexSize);
        ctx.beginPath();
        ctx.arc(pos.x + cx, pos.y + cy, TOWER_STATS[currentBuildMode].range, 0, Math.PI * 2);
        ctx.fillStyle = `${hoverColor}10`;
        ctx.fill();
        ctx.strokeStyle = `${hoverColor}40`;
        ctx.stroke();
      }
    }

    if (currentSelectedHex) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      drawHex(ctx, currentSelectedHex, eng.hexSize, cx, cy, false);
      
      // Draw range of selected tower
      const tower = eng.state.towers.find(t => hexToString(t.hex) === hexToString(currentSelectedHex));
      if (tower) {
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
      }
    }

    // Draw Towers
    eng.state.towers.forEach(tower => {
      const stats = TOWER_STATS[tower.type];
      const color = stats.color;
      
      ctx.save();
      ctx.translate(tower.x, tower.y);
      
      // Calculate rotation
      let angle = (time / 1000) * 0.5; // Idle rotation
      if (tower.targetId) {
        const target = eng.state.enemies.find(e => e.id === tower.targetId);
        if (target) {
          angle = Math.atan2(target.y - tower.y, target.x - tower.x);
        }
      }

      // Base of the tower (Hexagonal tech base)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const r = eng.hexSize * 0.85;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 10, 18, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.rotate(angle);

      ctx.shadowColor = color;
      ctx.shadowBlur = 15;

      const maxCooldown = 1 / stats.fireRate;
      const recoil = Math.max(0, tower.cooldown / maxCooldown);

      if (tower.type === 'laser') {
        ctx.translate(-recoil * 4, 0); // Recoil animation

        // Sleek, angular turret
        ctx.fillStyle = '#222233';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glowing core
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel glow
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(15, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

      } else if (tower.type === 'plasma') {
        // Circular reactor
        const pulse = Math.sin(time / 200) * 2;
        
        ctx.fillStyle = '#222233';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Energy rings
        ctx.beginPath();
        ctx.arc(0, 0, 6 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Prongs
        for(let i=0; i<3; i++) {
          ctx.save();
          ctx.rotate((Math.PI * 2 / 3) * i + time/500);
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(18, 0);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }

      } else if (tower.type === 'railgun') {
        ctx.translate(-recoil * 8, 0); // Heavy recoil animation

        // Long double-barreled structure
        ctx.fillStyle = '#222233';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -8, 20, 16);

        // Barrels
        ctx.fillStyle = '#11111a';
        ctx.fillRect(0, -6, 25, 4);
        ctx.fillRect(0, 2, 25, 4);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -6, 25, 4);
        ctx.strokeRect(0, 2, 25, 4);

        // Charge effect based on cooldown
        const chargeRatio = Math.max(0, 1 - recoil);
        if (chargeRatio > 0) {
          ctx.fillStyle = color;
          ctx.globalAlpha = chargeRatio;
          ctx.fillRect(5, -5, 20 * chargeRatio, 2);
          ctx.fillRect(5, 3, 20 * chargeRatio, 2);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      // Level indicator
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Lv${tower.level}`, tower.x, tower.y - eng.hexSize * 0.8);
    });

    // Draw Enemies
    eng.state.enemies.forEach(enemy => {
      const stats = ENEMY_STATS[enemy.type];
      const color = stats.color;
      
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      
      // Determine movement angle
      let angle = 0;
      const targetHex = eng.paths[enemy.pathId][enemy.pathIndex + 1];
      if (targetHex) {
        const targetPos = hexToPixel(targetHex, eng.hexSize);
        const tx = targetPos.x + cx;
        const ty = targetPos.y + cy;
        angle = Math.atan2(ty - enemy.y, tx - enemy.x);
      }
      
      ctx.rotate(angle);

      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;

      if (enemy.type === 'scout') {
        // Engine trail
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6 + Math.sin(time / 50) * 0.4;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(-16 - Math.random() * 4, 0);
        ctx.lineTo(-6, -2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Dart shape
        ctx.fillStyle = '#1a0505';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Engine glow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-6, 0, 2, 0, Math.PI * 2);
        ctx.fill();

      } else if (enemy.type === 'tank') {
        // Hexagonal heavy armor
        ctx.fillStyle = '#1a1000';
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          if (i === 0) ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
          else ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner armor plating
        ctx.beginPath();
        ctx.rect(-6, -6, 12, 12);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

      } else if (enemy.type === 'flyer') {
        // Swept-wing stealth drone
        const bob = Math.sin(time / 150 + enemy.x) * 3;
        ctx.translate(0, bob); // Bobbing effect
        
        ctx.fillStyle = '#051a05';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-6, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Energy wings
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-12, 16);
        ctx.lineTo(-8, 0);
        ctx.lineTo(-12, -16);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

      } else if (enemy.type === 'boss') {
        // Massive dreadnought
        ctx.fillStyle = '#110000';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(10, 15);
        ctx.lineTo(-15, 20);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-15, -20);
        ctx.lineTo(10, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Core
        const pulse = Math.sin(time / 100) * 3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 6 + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Nodes
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(10, 8, 3, 0, Math.PI * 2);
        ctx.arc(10, -8, 3, 0, Math.PI * 2);
        ctx.arc(-10, 12, 3, 0, Math.PI * 2);
        ctx.arc(-10, -12, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.shadowBlur = 0;

      // Health bar
      const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
      const barWidth = stats.radius * 2.5;
      const barY = enemy.y - stats.radius - 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(enemy.x - barWidth/2, barY, barWidth, 4);
      
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fillRect(enemy.x - barWidth/2, barY, barWidth * hpPercent, 4);
      ctx.shadowBlur = 0;
      
      // Freeze effect
      if (enemy.frozen && enemy.frozen > 0) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, stats.radius + 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Projectiles
    eng.state.projectiles.forEach(proj => {
      ctx.fillStyle = TOWER_STATS[proj.type].color;
      ctx.shadowColor = TOWER_STATS[proj.type].color;
      ctx.shadowBlur = 10;
      
      ctx.save();
      ctx.translate(proj.x, proj.y);
      
      // Calculate angle based on target
      const target = eng.state.enemies.find(e => e.id === proj.targetId);
      if (target) {
        const angle = Math.atan2(target.y - proj.y, target.x - proj.x);
        ctx.rotate(angle);
      }

      // Trail
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-proj.speed * 0.08, 0);
      ctx.strokeStyle = TOWER_STATS[proj.type].color;
      ctx.lineWidth = proj.type === 'railgun' ? 4 : 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (proj.type === 'laser') {
        // Fast energy bolt
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, 3);
        ctx.lineTo(-4, -3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -1, 6, 2);
      } else if (proj.type === 'plasma') {
        // Pulsing orb
        const pulse = Math.sin(time / 50) * 3;
        ctx.beginPath();
        ctx.arc(0, 0, 5 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.type === 'railgun') {
        // Hyper-fast streak
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-20, 2);
        ctx.lineTo(-20, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(5, -1, 15, 2);
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;
    });

    // Draw Particles
    ctx.lineCap = 'round';
    eng.state.particles.forEach(p => {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.lineWidth = p.size;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // Draw line based on velocity for spark effect
      ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
  };

  const drawHex = (ctx: CanvasRenderingContext2D, hex: Hex, size: number, cx: number, cy: number, fill: boolean, fillColor?: string) => {
    const pos = hexToPixel(hex, size);
    const x = pos.x + cx;
    const y = pos.y + cy;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    
    if (fill) {
      ctx.fillStyle = fillColor || 'rgba(0, 255, 255, 0.1)';
      ctx.fill();
    }
    ctx.stroke();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - engine.width / 2;
    const y = e.clientY - rect.top - engine.height / 2;
    
    const hex = pixelToHex(x, y, engine.hexSize);
    setHoverHex(hex);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedEnemy = engine.state.enemies.find(enemy => {
      const stats = ENEMY_STATS[enemy.type];
      const dx = enemy.x - clickX;
      const dy = enemy.y - clickY;
      return Math.sqrt(dx * dx + dy * dy) <= stats.radius * 2;
    });

    if (clickedEnemy) {
      setSelectedEnemyId(clickedEnemy.id);
      setSelectedHex(null);
      setBuildMode(null);
      return;
    }

    setSelectedEnemyId(null);

    if (!hoverHex) return;
    
    if (buildMode) {
      const success = engine.buildTower(hoverHex, buildMode);
      if (success) {
        // Spawn placement particles
        const pos = hexToPixel(hoverHex, engine.hexSize);
        const color = TOWER_STATS[buildMode].color;
        for (let i = 0; i < 20; i++) {
          engine.state.particles.push({
            x: pos.x + engine.width / 2,
            y: pos.y + engine.height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1,
            maxLife: 1,
            color: color,
            size: Math.random() * 4 + 2
          });
        }
        setBuildMode(null);
      } else {
        setShake(10);
      }
    } else {
      setSelectedHex(hoverHex);
    }
  };

  useEffect(() => {
    if (shake > 0) {
      const timer = setTimeout(() => setShake(s => Math.max(0, s - 1)), 16);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current && engine) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
        engine.width = clientWidth;
        engine.height = clientHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing
    return () => window.removeEventListener('resize', handleResize);
  }, [engine]);

  const selectedTower = (gameState && selectedHex) ? gameState.towers.find(t => hexToString(t.hex) === hexToString(selectedHex)) : null;

  return (
    <div className="w-full h-screen bg-[#0a0a12] text-white font-sans overflow-hidden relative flex flex-col" ref={containerRef}>
      
      {/* Game Canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{ transform: shake > 0 ? `translate(${(Math.random()-0.5)*shake}px, ${(Math.random()-0.5)*shake}px)` : 'none' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); setBuildMode(null); setSelectedHex(null); setSelectedEnemyId(null); }}
      />

      {gameState && (
        <>
          {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex gap-6 pointer-events-auto">
          <div className="bg-[#050510]/90 backdrop-blur-md border-l-4 border-cyan-500 rounded-r-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(0,255,255,0.15)] transition-all hover:shadow-[0_0_30px_rgba(0,255,255,0.25)]">
            <div className="p-2 bg-cyan-500/20 rounded-lg"><Coins className="text-cyan-400" size={24} /></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-cyan-500 uppercase tracking-widest font-bold">Credits</span>
              <span className="text-2xl font-black font-mono text-cyan-50 leading-none">{gameState.credits}</span>
            </div>
          </div>
          
          <div className="bg-[#050510]/90 backdrop-blur-md border-l-4 border-red-500 rounded-r-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(255,0,0,0.15)] transition-all hover:shadow-[0_0_30px_rgba(255,0,0,0.25)]">
            <div className="p-2 bg-red-500/20 rounded-lg"><Shield className="text-red-400" size={24} /></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Core Integrity</span>
              <div className="w-40 h-3 bg-red-950/50 rounded-full mt-1 overflow-hidden border border-red-500/20">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_15px_rgba(255,0,0,0.8)] transition-all duration-300" 
                  style={{ width: `${(gameState.baseHp / gameState.maxBaseHp) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#050510]/90 backdrop-blur-md border-r-4 border-fuchsia-500 rounded-l-xl p-4 flex items-center gap-6 pointer-events-auto shadow-[0_0_20px_rgba(255,0,255,0.15)]">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-fuchsia-500 uppercase tracking-widest font-bold">Current Wave</span>
            <span className="text-3xl font-black font-mono text-fuchsia-50 leading-none">{gameState.wave}</span>
          </div>
          <button 
            onClick={() => !gameState.waveActive && engine?.startWave()}
            disabled={gameState.waveActive}
            className={`relative group overflow-hidden p-4 rounded-xl transition-all duration-300 ${
              gameState.waveActive 
                ? 'bg-fuchsia-900/20 border border-fuchsia-900/50 text-fuchsia-900/50 cursor-not-allowed' 
                : 'bg-fuchsia-600/20 hover:bg-fuchsia-500/40 border border-fuchsia-500 text-fuchsia-300 hover:text-white shadow-[0_0_15px_rgba(255,0,255,0.3)] hover:shadow-[0_0_25px_rgba(255,0,255,0.6)] hover:scale-105'
            }`}
          >
            {!gameState.waveActive && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/30 to-fuchsia-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />}
            <Play size={24} className="relative z-10 fill-current" />
          </button>
        </div>
      </div>

      {/* Bottom Build Menu */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 z-10 pointer-events-auto">
        {(Object.entries(TOWER_STATS) as [TowerType, typeof TOWER_STATS[TowerType]][]).map(([type, stats]) => {
          const canAfford = gameState.credits >= stats.cost;
          const isSelected = buildMode === type;
          return (
            <button
              key={type}
              onClick={() => {
                if (canAfford || isSelected) {
                  setBuildMode(isSelected ? null : type);
                } else {
                  setShake(10);
                }
              }}
              className={`
                relative group flex flex-col items-center p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300
                ${isSelected 
                  ? 'bg-[#1a1a2e]/90 border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-110 -translate-y-4' 
                  : 'bg-[#050510]/80 border-white/10 hover:bg-[#1a1a2e]/80 hover:border-white/30 hover:-translate-y-2'}
                ${!canAfford && !isSelected ? 'opacity-50 grayscale-[0.8] cursor-not-allowed hover:-translate-y-0' : 'cursor-pointer'}
              `}
            >
              <div className="w-14 h-14 rounded-xl mb-3 flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{ color: stats.color, backgroundColor: `${stats.color}15`, boxShadow: `0 0 20px ${stats.color}40`, border: `1px solid ${stats.color}40` }}>
                {type === 'laser' && <Zap size={28} />}
                {type === 'plasma' && <Crosshair size={28} />}
                {type === 'railgun' && <Hammer size={28} />}
              </div>
              <span className="font-black tracking-wider text-sm">{stats.name}</span>
              <span className="text-cyan-400 font-mono text-xs mt-1 font-bold">{stats.cost} CR</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-6 bg-[#050510]/95 border border-white/20 p-4 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none w-56 text-left shadow-[0_0_30px_rgba(0,0,0,0.8)] translate-y-2 group-hover:translate-y-0">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">Specs</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-gray-400">DMG</span><span className="text-white font-mono">{stats.damage}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">RNG</span><span className="text-white font-mono">{stats.range}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">SPD</span><span className="text-white font-mono">{stats.fireRate}/s</span></div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Tower Menu */}
      {selectedTower && !buildMode && (
        <div className="absolute top-1/2 right-8 -translate-y-1/2 bg-[#050510]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-72 shadow-[0_0_40px_rgba(0,0,0,0.8)] z-10 pointer-events-auto overflow-hidden animate-in slide-in-from-right-8 duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10" style={{ color: TOWER_STATS[selectedTower.type].color, boxShadow: `0 0 20px ${TOWER_STATS[selectedTower.type].color}40` }}>
              {selectedTower.type === 'laser' && <Zap size={24} />}
              {selectedTower.type === 'plasma' && <Crosshair size={24} />}
              {selectedTower.type === 'railgun' && <Hammer size={24} />}
            </div>
            <div>
              <h3 className="text-xl font-black tracking-wide text-white">{TOWER_STATS[selectedTower.type].name}</h3>
              <div className="text-xs text-cyan-400 font-mono font-bold tracking-widest uppercase">Level {selectedTower.level}</div>
            </div>
          </div>
          
          <div className="space-y-4 mb-8">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400 uppercase tracking-wider">Damage</span>
                <span className="font-mono text-white">{Math.round(selectedTower.damage)}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedTower.damage / 500) * 100)}%`, backgroundColor: TOWER_STATS[selectedTower.type].color, boxShadow: `0 0 10px ${TOWER_STATS[selectedTower.type].color}` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400 uppercase tracking-wider">Range</span>
                <span className="font-mono text-white">{Math.round(selectedTower.range)}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedTower.range / 400) * 100)}%`, backgroundColor: TOWER_STATS[selectedTower.type].color, boxShadow: `0 0 10px ${TOWER_STATS[selectedTower.type].color}` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400 uppercase tracking-wider">Fire Rate</span>
                <span className="font-mono text-white">{selectedTower.fireRate.toFixed(1)}/s</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedTower.fireRate / 5) * 100)}%`, backgroundColor: TOWER_STATS[selectedTower.type].color, boxShadow: `0 0 10px ${TOWER_STATS[selectedTower.type].color}` }} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => {
                const cost = TOWER_STATS[selectedTower.type].cost * selectedTower.level;
                if (gameState.credits >= cost) {
                  engine?.upgradeTower(selectedTower.id);
                } else {
                  setShake(10);
                }
              }}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all duration-300 group
                ${gameState.credits >= TOWER_STATS[selectedTower.type].cost * selectedTower.level 
                  ? 'bg-cyan-600/10 hover:bg-cyan-600/30 border border-cyan-500/30 hover:border-cyan-500/80 cursor-pointer' 
                  : 'bg-cyan-600/5 border border-cyan-500/10 opacity-50 cursor-not-allowed grayscale'}`}
            >
              <div className="flex items-center gap-3">
                <ArrowUpCircle size={18} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="font-bold tracking-wide">Upgrade</span>
              </div>
              <span className="font-mono text-cyan-300 font-bold">{TOWER_STATS[selectedTower.type].cost * selectedTower.level} CR</span>
            </button>
            
            <button 
              onClick={() => { engine?.sellTower(selectedTower.id); setSelectedHex(null); }}
              className="w-full py-3 px-4 bg-red-600/10 hover:bg-red-600/30 border border-red-500/30 hover:border-red-500/80 rounded-xl flex items-center justify-between transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} className="text-red-400 group-hover:scale-110 transition-transform" />
                <span className="font-bold tracking-wide">Recycle</span>
              </div>
              <span className="font-mono text-red-300 font-bold">+{Math.floor((TOWER_STATS[selectedTower.type].cost * selectedTower.level) * 0.5)} CR</span>
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.status === 'gameover' && (
        <div className="absolute inset-0 bg-[#050510]/90 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-1000">
          <div className="bg-[#0a0a12] border border-red-500/50 p-12 rounded-3xl text-center shadow-[0_0_100px_rgba(255,0,0,0.3)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
            <h2 className="text-7xl font-black text-red-500 mb-4 tracking-tighter drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">SYSTEM FAILURE</h2>
            <p className="text-xl text-red-200/70 mb-10 font-mono uppercase tracking-widest">Core breached at Wave {gameState.wave}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-red-600/20 hover:bg-red-500/40 border border-red-500 text-red-100 font-bold rounded-xl flex items-center gap-3 mx-auto transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,0,0,0.5)] group"
            >
              <RotateCcw size={24} className="group-hover:-rotate-180 transition-transform duration-500" />
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
