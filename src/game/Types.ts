import { Hex, hexToPixel, hexToString } from './HexMath';

export type EnemyType = 'scout' | 'tank' | 'flyer' | 'boss';
export type TowerType = 'laser' | 'plasma' | 'railgun';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  pathId: number;
  pathIndex: number;
  frozen?: number;
}

export interface Tower {
  id: string;
  type: TowerType;
  hex: Hex;
  x: number;
  y: number;
  level: number;
  range: number;
  damage: number;
  fireRate: number; // shots per second
  cooldown: number;
  targetId: string | null;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetId: string;
  speed: number;
  damage: number;
  type: TowerType;
  splashRadius?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  credits: number;
  baseHp: number;
  maxBaseHp: number;
  wave: number;
  waveActive: boolean;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  particles: Particle[];
  status: 'playing' | 'gameover' | 'victory';
}

export const TOWER_STATS: Record<TowerType, { cost: number; range: number; damage: number; fireRate: number; color: string; name: string }> = {
  laser: { cost: 50, range: 150, damage: 10, fireRate: 2, color: '#00ffff', name: 'Pulse Laser' },
  plasma: { cost: 100, range: 120, damage: 25, fireRate: 0.8, color: '#ff00ff', name: 'Plasma Burst' },
  railgun: { cost: 200, range: 300, damage: 100, fireRate: 0.3, color: '#ffff00', name: 'Railgun' },
};

export const ENEMY_STATS: Record<EnemyType, { hp: number; speed: number; reward: number; color: string; radius: number }> = {
  scout: { hp: 30, speed: 60, reward: 5, color: '#ff3333', radius: 8 },
  tank: { hp: 150, speed: 30, reward: 15, color: '#ff8800', radius: 12 },
  flyer: { hp: 50, speed: 80, reward: 10, color: '#33ff33', radius: 6 },
  boss: { hp: 1000, speed: 20, reward: 100, color: '#ff0000', radius: 20 },
};
