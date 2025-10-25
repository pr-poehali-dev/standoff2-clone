import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';

interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  team: 'blue' | 'red';
  id: number;
  name: string;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 'blue' | 'red';
  damage: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GameProgress {
  total_kills: number;
  total_deaths: number;
  wins: number;
  losses: number;
  experience: number;
  level: number;
}

interface Weapon {
  name: string;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  magazineSize: number;
  unlockLevel: number;
}

const WEAPONS: Weapon[] = [
  { name: 'Пистолет', damage: 15, fireRate: 500, bulletSpeed: 8, magazineSize: 12, unlockLevel: 1 },
  { name: 'Автомат', damage: 10, fireRate: 150, bulletSpeed: 10, magazineSize: 30, unlockLevel: 2 },
  { name: 'Снайперка', damage: 50, fireRate: 1500, bulletSpeed: 15, magazineSize: 5, unlockLevel: 5 },
];

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStarted, setGameStarted] = useState(false);
  const [progress, setProgress] = useState<GameProgress>({
    total_kills: 0,
    total_deaths: 0,
    wins: 0,
    losses: 0,
    experience: 0,
    level: 1,
  });
  const [lastShootTime, setLastShootTime] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [ammo, setAmmo] = useState(500);
  const [currentWeapon, setCurrentWeapon] = useState(0);
  const joystickStartRef = useRef({ x: 0, y: 0 });

  const playerRef = useRef<Player>({
    x: 100,
    y: 300,
    angle: 0,
    health: 100,
    team: 'blue',
    id: 0,
    name: 'Боль',
  });

  const bossRef = useRef<Player>({
    x: 800,
    y: 300,
    angle: Math.PI,
    health: 100,
    team: 'red',
    id: 999,
    name: 'Боль (Враг)',
  });

  const enemiesRef = useRef<Player[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0 });
  const gameSessionRef = useRef({ kills: 0, deaths: 0 });
  const animationFrameRef = useRef<number>(0);

  const obstacles: Obstacle[] = [
    { x: 300, y: 150, width: 80, height: 80 },
    { x: 500, y: 300, width: 100, height: 60 },
    { x: 200, y: 450, width: 120, height: 40 },
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const response = await fetch(
        'https://functions.poehali.dev/51986827-6ede-4dc3-8a70-1c03bbfca9bc?player_id=guest'
      );
      const data = await response.json();
      const level = Math.floor(data.experience / 100) + 1;
      setProgress({ ...data, level });
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const saveProgress = async (won: boolean) => {
    try {
      await fetch('https://functions.poehali.dev/51986827-6ede-4dc3-8a70-1c03bbfca9bc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: 'guest',
          kills: gameSessionRef.current.kills,
          deaths: gameSessionRef.current.deaths,
          won,
        }),
      });
      await loadProgress();
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  useEffect(() => {
    enemiesRef.current.push(bossRef.current);
    for (let i = 0; i < 2; i++) {
      enemiesRef.current.push({
        x: 700 + Math.random() * 100,
        y: 100 + Math.random() * 400,
        angle: Math.PI,
        health: 100,
        team: 'red',
        id: i + 1,
        name: `Враг ${i + 1}`,
      });
    }
  }, []);

  useEffect(() => {
    if (!gameStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const won = score.blue > score.red;
          saveProgress(won);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, score]);

  const handleJoystickStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    joystickStartRef.current = { x: touch.clientX, y: touch.clientY };
    setJoystickActive(true);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickStartRef.current.x;
    const dy = touch.clientY - joystickStartRef.current.y;
    const distance = Math.min(50, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    setJoystickPos({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    });
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === '1') setCurrentWeapon(0);
      if (e.key === '2' && progress.level >= 2) setCurrentWeapon(1);
      if (e.key === '3' && progress.level >= 5) setCurrentWeapon(2);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && gameStarted) {
        shoot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameStarted, progress.level]);

  const shoot = () => {
    if (ammo <= 0) return;
    
    const weapon = WEAPONS[currentWeapon];
    const now = Date.now();
    if (now - lastShootTime < weapon.fireRate) return;
    
    setLastShootTime(now);
    setAmmo((prev) => prev - 1);
    
    const player = playerRef.current;
    bulletsRef.current.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(player.angle) * weapon.bulletSpeed,
      vy: Math.sin(player.angle) * weapon.bulletSpeed,
      team: player.team,
      damage: weapon.damage,
    });
  };

  const checkCollision = (x: number, y: number, size: number): boolean => {
    for (const obs of obstacles) {
      if (
        x + size > obs.x &&
        x - size < obs.x + obs.width &&
        y + size > obs.y &&
        y - size < obs.y + obs.height
      ) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      if (!gameStarted) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const player = playerRef.current;

      const dx = mouseRef.current.x - player.x;
      const dy = mouseRef.current.y - player.y;
      player.angle = Math.atan2(dy, dx);

      const speed = 3;
      let newX = player.x;
      let newY = player.y;

      if (joystickActive) {
        newX += (joystickPos.x / 50) * speed;
        newY += (joystickPos.y / 50) * speed;
      } else {
        if (keysRef.current.has('w') || keysRef.current.has('arrowup')) newY -= speed;
        if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) newY += speed;
        if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) newX -= speed;
        if (keysRef.current.has('d') || keysRef.current.has('arrowright')) newX += speed;
      }

      if (!checkCollision(newX, player.y, 15)) player.x = newX;
      if (!checkCollision(player.x, newY, 15)) player.y = newY;

      player.x = Math.max(15, Math.min(canvas.width - 15, player.x));
      player.y = Math.max(15, Math.min(canvas.height - 15, player.y));

      bulletsRef.current = bulletsRef.current.filter((bullet) => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        if (checkCollision(bullet.x, bullet.y, 3)) return false;

        if (
          bullet.x < 0 ||
          bullet.x > canvas.width ||
          bullet.y < 0 ||
          bullet.y > canvas.height
        ) {
          return false;
        }

        for (let i = 0; i < enemiesRef.current.length; i++) {
          const enemy = enemiesRef.current[i];
          const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
          if (dist < 20 && bullet.team !== enemy.team) {
            enemy.health -= bullet.damage;
            
            if (enemy.health <= 0) {
              const isBoss = enemy.id === 999;
              enemiesRef.current.splice(i, 1);
              gameSessionRef.current.kills++;
              setScore((prev) => ({ ...prev, blue: prev.blue + 1 }));
              
              setTimeout(() => {
                const newEnemy: Player = isBoss
                  ? {
                      x: 700 + Math.random() * 100,
                      y: 100 + Math.random() * 400,
                      angle: Math.PI,
                      health: 100,
                      team: 'red',
                      id: 999,
                      name: 'Боль (Враг)',
                    }
                  : {
                      x: 700 + Math.random() * 100,
                      y: 100 + Math.random() * 400,
                      angle: Math.PI,
                      health: 100,
                      team: 'red',
                      id: Date.now(),
                      name: `Враг ${Math.floor(Math.random() * 10)}`,
                    };
                enemiesRef.current.push(newEnemy);
                if (isBoss) bossRef.current = newEnemy;
              }, 3000);
            }
            return false;
          }
        }

        const distToPlayer = Math.hypot(bullet.x - player.x, bullet.y - player.y);
        if (distToPlayer < 20 && bullet.team !== player.team) {
          player.health -= bullet.damage;
          if (player.health <= 0) {
            gameSessionRef.current.deaths++;
            setScore((prev) => ({ ...prev, red: prev.red + 1 }));
            player.health = 100;
            player.x = 100;
            player.y = 300;
          }
          return false;
        }

        return true;
      });

      enemiesRef.current.forEach((enemy) => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        enemy.angle = Math.atan2(dy, dx);

        const shootChance = enemy.id === 999 ? 0.02 : 0.01;
        if (Math.random() < shootChance) {
          const damage = enemy.id === 999 ? 20 : 10;
          const speed = enemy.id === 999 ? 8 : 6;
          bulletsRef.current.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(enemy.angle) * speed,
            vy: Math.sin(enemy.angle) * speed,
            team: enemy.team,
            damage,
          });
        }
      });

      ctx.fillStyle = '#1A1F2C';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#2A3F5C';
      obstacles.forEach((obs) => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#3A5F7C';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      });

      const drawPlayer = (p: Player) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        const isBoss = p.id === 999;
        const size = isBoss ? 20 : 15;
        
        ctx.fillStyle = p.team === 'blue' ? '#0EA5E9' : '#ea384c';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        if (isBoss) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(size - 5, -3, 12, 6);

        ctx.restore();

        ctx.font = '10px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - size - 15);

        const barWidth = isBoss ? 50 : 40;
        ctx.fillStyle = p.team === 'blue' ? '#0EA5E9' : '#ea384c';
        ctx.fillRect(p.x - barWidth / 2, p.y - size - 10, barWidth, 4);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(p.x - barWidth / 2, p.y - size - 10, (barWidth * p.health) / 100, 4);
      };

      drawPlayer(player);
      enemiesRef.current.forEach(drawPlayer);

      bulletsRef.current.forEach((bullet) => {
        ctx.fillStyle = bullet.team === 'blue' ? '#60A5FA' : '#F87171';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStarted, joystickActive, joystickPos]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canvasWidth = isMobile ? Math.min(window.innerWidth - 20, 800) : 1000;
  const canvasHeight = isMobile ? Math.min(window.innerHeight * 0.6, 600) : 600;

  const availableWeapons = WEAPONS.filter((w) => w.unlockLevel <= progress.level);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F1419] p-2 md:p-4">
      <div className="mb-2 md:mb-4 flex gap-4 md:gap-8 items-center text-sm md:text-base flex-wrap justify-center">
        <div className="text-[#0EA5E9] font-bold">Синие: {score.blue}</div>
        <div className="text-white font-bold text-xl md:text-3xl">{formatTime(timeLeft)}</div>
        <div className="text-[#ea384c] font-bold">Красные: {score.red}</div>
      </div>

      <div className="mb-2 text-white/80 text-xs md:text-sm flex gap-4 flex-wrap justify-center">
        <span>Уровень: {progress.level}</span>
        <span>Очки: {progress.experience}</span>
        <span>Патроны: {ammo}/500</span>
        <span className="text-yellow-400">{WEAPONS[currentWeapon].name}</span>
      </div>

      <div className="mb-2 text-white/60 text-xs flex gap-2">
        {availableWeapons.map((weapon, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentWeapon(WEAPONS.indexOf(weapon))}
            className={`px-2 py-1 rounded ${
              currentWeapon === WEAPONS.indexOf(weapon)
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {idx + 1}. {weapon.name}
          </button>
        ))}
      </div>

      {!gameStarted && (
        <button
          onClick={() => setGameStarted(true)}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold text-xl md:text-2xl px-8 md:px-12 py-4 md:py-6 rounded-lg transition-colors z-10"
        >
          НАЧАТЬ ИГРУ
        </button>
      )}

      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="border-2 md:border-4 border-[#2A3F5C] rounded-lg shadow-2xl"
      />

      {!isMobile && (
        <div className="mt-4 text-white/60 text-sm">
          WASD — движение | Мышь — прицел | ЛКМ — выстрел | 1-3 — смена оружия
        </div>
      )}

      {isMobile && gameStarted && (
        <>
          <div
            className="fixed bottom-24 left-8 w-32 h-32 bg-white/10 rounded-full flex items-center justify-center"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div
              className="w-16 h-16 bg-[#0EA5E9] rounded-full transition-transform"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            />
          </div>

          <button
            onClick={shoot}
            className="fixed bottom-24 right-8 w-20 h-20 bg-[#ea384c] hover:bg-[#dc2626] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Icon name="Target" size={32} className="text-white" />
          </button>
        </>
      )}

      {timeLeft === 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-20 p-4">
          <div className="bg-[#1A1F2C] p-6 md:p-8 rounded-lg text-center max-w-md w-full">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-2">
              {score.blue > score.red ? 'Победа! 👍' : 'Поражение :('}
            </h2>
            <div className="text-white/80 mb-6 space-y-2">
              <p className="text-lg">Счёт: {score.blue} - {score.red}</p>
              <p>Убийств: {gameSessionRef.current.kills}</p>
              <p>Смертей: {gameSessionRef.current.deaths}</p>
              <p>Патронов израсходовано: {500 - ammo}</p>
              <p className="text-yellow-400 font-bold">
                Уровень {progress.level} | {progress.experience} очков
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold px-8 py-3 rounded-lg transition-colors"
            >
              НОВАЯ ИГРА
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
