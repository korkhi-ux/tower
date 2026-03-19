import { Hex, hexToPixel, hexDistance, hexToString, hexLerp, hexRound } from './HexMath';
import { GameState, Enemy, Tower, Projectile, Particle, TOWER_STATS, ENEMY_STATS, TowerType, EnemyType } from './Types';

export class GameEngine {
  public state: GameState;
  public paths: Hex[][];
  public hexSize: number = 30;
  public width: number;
  public height: number;
  
  private lastTime: number = 0;
  private waveTimer: number = 0;
  private enemiesToSpawn: EnemyType[] = [];
  private spawnInterval: number = 1;
  private spawnTimer: number = 0;
  
  public onStateChange?: (state: GameState) => void;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.paths = this.generatePaths();
    this.state = {
      credits: 150,
      baseHp: 100,
      maxBaseHp: 100,
      wave: 0,
      waveActive: false,
      enemies: [],
      towers: [],
      projectiles: [],
      particles: [],
      status: 'playing',
    };
  }

  private generatePaths(): Hex[][] {
    const base = { q: 8, r: 0, s: -8 };
    const spawn1 = { q: -11, r: -2, s: 13 };
    const spawn2 = { q: -11, r: 4, s: 7 };
    
    const intA = { q: -6, r: 1, s: 5 };
    const intB = { q: 0, r: 0, s: 0 };
    const intC = { q: 5, r: -1, s: -4 };

    const path1 = this.generatePathFromWaypoints([
      spawn1,
      { q: -7, r: -5, s: 12 },
      { q: -2, r: -5, s: 7 },
      { q: 3, r: -4, s: 1 },
      intC,
      base
    ]);

    const path2 = this.generatePathFromWaypoints([
      spawn1,
      intA,
      intB,
      intC,
      base
    ]);

    const path3 = this.generatePathFromWaypoints([
      spawn2,
      intA,
      { q: -3, r: 4, s: -1 },
      intB,
      { q: 3, r: 2, s: -5 },
      base
    ]);

    const path4 = this.generatePathFromWaypoints([
      spawn2,
      { q: -6, r: 6, s: 0 },
      { q: 0, r: 5, s: -5 },
      { q: 5, r: 3, s: -8 },
      base
    ]);

    const path5 = this.generatePathFromWaypoints([
      spawn1,
      { q: -7, r: -5, s: 12 },
      { q: -2, r: -5, s: 7 },
      intB,
      { q: 3, r: 2, s: -5 },
      base
    ]);

    const path6 = this.generatePathFromWaypoints([
      spawn2,
      { q: -6, r: 6, s: 0 },
      { q: 0, r: 5, s: -5 },
      intC,
      base
    ]);

    return [path1, path2, path3, path4, path5, path6];
  }

  private generatePathFromWaypoints(waypoints: Hex[]): Hex[] {
    const path: Hex[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      const dist = hexDistance(start, end);
      for (let step = 0; step < dist; step++) {
        const t = dist === 0 ? 0 : step / dist;
        path.push(hexRound(hexLerp(start, end, t)));
      }
    }
    path.push(waypoints[waypoints.length - 1]);
    
    const uniquePath: Hex[] = [];
    const seen = new Set<string>();
    for (const hex of path) {
      const str = hexToString(hex);
      if (!seen.has(str)) {
        seen.add(str);
        uniquePath.push(hex);
      }
    }
    return uniquePath;
  }

  public startWave() {
    if (this.enemiesToSpawn.length > 0 || this.state.enemies.length > 0) return;
    
    this.state.wave++;
    const wave = this.state.wave;
    
    // Generate enemies based on wave
    let count = 5 + wave * 2;
    for (let i = 0; i < count; i++) {
      if (wave % 5 === 0 && i === count - 1) {
        this.enemiesToSpawn.push('boss');
      } else if (wave > 2 && Math.random() < 0.3) {
        this.enemiesToSpawn.push('tank');
      } else if (wave > 3 && Math.random() < 0.2) {
        this.enemiesToSpawn.push('flyer');
      } else {
        this.enemiesToSpawn.push('scout');
      }
    }
    
    // Scale stats
    this.spawnInterval = Math.max(0.2, 1 - wave * 0.05);
    this.state.waveActive = true;
    this.notify();
  }

  public buildTower(hex: Hex, type: TowerType): boolean {
    if (this.state.credits < TOWER_STATS[type].cost) return false;
    
    // Check if on path
    const hexStr = hexToString(hex);
    if (this.paths.some(path => path.some(p => hexToString(p) === hexStr))) return false;
    
    // Check if already occupied
    if (this.state.towers.some(t => hexToString(t.hex) === hexStr)) return false;

    const pos = hexToPixel(hex, this.hexSize);
    // Center offset
    pos.x += this.width / 2;
    pos.y += this.height / 2;

    this.state.credits -= TOWER_STATS[type].cost;
    this.state.towers.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      hex,
      x: pos.x,
      y: pos.y,
      level: 1,
      range: TOWER_STATS[type].range,
      damage: TOWER_STATS[type].damage,
      fireRate: TOWER_STATS[type].fireRate,
      cooldown: 0,
      targetId: null,
    });
    
    this.createParticles(pos.x, pos.y, TOWER_STATS[type].color, 10);
    this.notify();
    return true;
  }

  public upgradeTower(id: string): boolean {
    const tower = this.state.towers.find(t => t.id === id);
    if (!tower) return false;
    
    const cost = TOWER_STATS[tower.type].cost * tower.level;
    if (this.state.credits < cost) return false;
    
    this.state.credits -= cost;
    tower.level++;
    tower.damage *= 1.5;
    tower.range *= 1.1;
    tower.fireRate *= 1.1;
    
    this.createParticles(tower.x, tower.y, '#ffffff', 15);
    this.notify();
    return true;
  }

  public sellTower(id: string) {
    const index = this.state.towers.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const tower = this.state.towers[index];
    const refund = Math.floor((TOWER_STATS[tower.type].cost * tower.level) * 0.5);
    this.state.credits += refund;
    this.state.towers.splice(index, 1);
    this.createParticles(tower.x, tower.y, '#ff0000', 10);
    this.notify();
  }

  public update(dt: number) {
    if (this.state.status !== 'playing') return;

    this.spawnEnemies(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);

    if (this.state.waveActive && this.enemiesToSpawn.length === 0 && this.state.enemies.length === 0) {
      this.state.waveActive = false;
      this.notify();
    }
  }

  private spawnEnemies(dt: number) {
    if (this.enemiesToSpawn.length === 0) return;
    
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const type = this.enemiesToSpawn.shift()!;
      const pathId = Math.floor(Math.random() * this.paths.length);
      const startHex = this.paths[pathId][0];
      const pos = hexToPixel(startHex, this.hexSize);
      
      // Scale HP based on wave
      const hpScale = 1 + (this.state.wave - 1) * 0.2;
      const stats = ENEMY_STATS[type];
      
      this.state.enemies.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: pos.x + this.width / 2,
        y: pos.y + this.height / 2,
        hp: stats.hp * hpScale,
        maxHp: stats.hp * hpScale,
        speed: stats.speed,
        reward: stats.reward,
        pathId,
        pathIndex: 0,
      });
      
      this.spawnTimer = this.spawnInterval;
    }
  }

  private updateEnemies(dt: number) {
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      const enemy = this.state.enemies[i];
      
      if (enemy.hp <= 0) {
        this.state.credits += enemy.reward;
        this.createParticles(enemy.x, enemy.y, ENEMY_STATS[enemy.type].color, 15);
        this.state.enemies.splice(i, 1);
        this.notify();
        continue;
      }

      const targetHex = this.paths[enemy.pathId][enemy.pathIndex + 1];
      if (!targetHex) {
        // Reached end
        this.state.baseHp -= enemy.type === 'boss' ? 10 : 1;
        this.state.enemies.splice(i, 1);
        if (this.state.baseHp <= 0) {
          this.state.status = 'gameover';
        }
        this.notify();
        continue;
      }

      const targetPos = hexToPixel(targetHex, this.hexSize);
      targetPos.x += this.width / 2;
      targetPos.y += this.height / 2;

      const dx = targetPos.x - enemy.x;
      const dy = targetPos.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        enemy.pathIndex++;
        
        // Path switching logic
        const currentHex = this.paths[enemy.pathId][enemy.pathIndex];
        if (currentHex) {
          const currentHexStr = hexToString(currentHex);
          const possiblePaths: { id: number, index: number }[] = [];
          
          for (let pId = 0; pId < this.paths.length; pId++) {
            const pIndex = this.paths[pId].findIndex(h => hexToString(h) === currentHexStr);
            // Only allow switching if it's not the end of the path
            if (pIndex !== -1 && pIndex < this.paths[pId].length - 1) {
              possiblePaths.push({ id: pId, index: pIndex });
            }
          }
          
          if (possiblePaths.length > 1) {
            // Randomly choose one of the possible paths
            const chosen = possiblePaths[Math.floor(Math.random() * possiblePaths.length)];
            enemy.pathId = chosen.id;
            enemy.pathIndex = chosen.index;
          }
        }
      } else {
        const speed = enemy.speed * (enemy.frozen && enemy.frozen > 0 ? 0.5 : 1);
        if (enemy.frozen) enemy.frozen -= dt;
        
        enemy.x += (dx / dist) * speed * dt;
        enemy.y += (dy / dist) * speed * dt;
      }
    }
  }

  private updateTowers(dt: number) {
    for (const tower of this.state.towers) {
      tower.cooldown -= dt;
      
      if (tower.cooldown <= 0) {
        // Find target
        let target = this.state.enemies.find(e => e.id === tower.targetId);
        
        if (!target || this.getDistance(tower, target) > tower.range) {
          // Find new target (closest to base)
          target = this.state.enemies
            .filter(e => this.getDistance(tower, e) <= tower.range)
            .sort((a, b) => b.pathIndex - a.pathIndex)[0];
            
          tower.targetId = target ? target.id : null;
        }

        if (target) {
          this.fireProjectile(tower, target);
          tower.cooldown = 1 / tower.fireRate;
        }
      }
    }
  }

  private fireProjectile(tower: Tower, target: Enemy) {
    this.state.projectiles.push({
      id: Math.random().toString(36).substr(2, 9),
      x: tower.x,
      y: tower.y,
      targetId: target.id,
      speed: 400,
      damage: tower.damage,
      type: tower.type,
      splashRadius: tower.type === 'plasma' ? 60 : 0,
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      const target = this.state.enemies.find(e => e.id === proj.targetId);

      if (!target) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        // Hit
        if (proj.splashRadius && proj.splashRadius > 0) {
          // Splash damage
          for (const enemy of this.state.enemies) {
            if (this.getDistance(target, enemy) <= proj.splashRadius) {
              enemy.hp -= proj.damage;
            }
          }
          this.createParticles(target.x, target.y, TOWER_STATS[proj.type].color, 20);
        } else {
          // Single target
          target.hp -= proj.damage;
          this.createParticles(target.x, target.y, TOWER_STATS[proj.type].color, 5);
        }
        this.state.projectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * proj.speed * dt;
        proj.y += (dy / dist) * proj.speed * dt;
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.state.particles.splice(i, 1);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size *= 0.95; // shrink
      }
    }
  }

  private createParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 50 + 20;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color,
        size: Math.random() * 3 + 2,
      });
    }
  }

  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private notify() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }
}
