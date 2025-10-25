import { useEffect, useRef, useState } from 'react';

interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  team: 'blue' | 'red';
  id: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 'blue' | 'red';
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [timeLeft, setTimeLeft] = useState(180);
  const [gameStarted, setGameStarted] = useState(false);

  const playerRef = useRef<Player>({
    x: 100,
    y: 300,
    angle: 0,
    health: 100,
    team: 'blue',
    id: 0,
  });

  const enemiesRef = useRef<Player[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0 });

  const obstacles: Obstacle[] = [
    { x: 300, y: 150, width: 80, height: 80 },
    { x: 500, y: 300, width: 100, height: 60 },
    { x: 700, y: 100, width: 60, height: 120 },
    { x: 200, y: 450, width: 120, height: 40 },
    { x: 600, y: 450, width: 80, height: 80 },
  ];

  useEffect(() => {
    for (let i = 0; i < 5; i++) {
      enemiesRef.current.push({
        x: 700 + Math.random() * 100,
        y: 100 + Math.random() * 400,
        angle: Math.PI,
        health: 100,
        team: 'red',
        id: i + 1,
      });
    }
  }, []);

  useEffect(() => {
    if (!gameStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
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
  }, [gameStarted]);

  const shoot = () => {
    const player = playerRef.current;
    const speed = 8;
    bulletsRef.current.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(player.angle) * speed,
      vy: Math.sin(player.angle) * speed,
      team: player.team,
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

    let animationId: number;

    const gameLoop = () => {
      if (!gameStarted) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      const player = playerRef.current;

      const dx = mouseRef.current.x - player.x;
      const dy = mouseRef.current.y - player.y;
      player.angle = Math.atan2(dy, dx);

      const speed = 3;
      let newX = player.x;
      let newY = player.y;

      if (keysRef.current.has('w')) newY -= speed;
      if (keysRef.current.has('s')) newY += speed;
      if (keysRef.current.has('a')) newX -= speed;
      if (keysRef.current.has('d')) newX += speed;

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
            enemy.health -= 25;
            if (enemy.health <= 0) {
              enemiesRef.current.splice(i, 1);
              setScore((prev) => ({ ...prev, blue: prev.blue + 1 }));
            }
            return false;
          }
        }

        const distToPlayer = Math.hypot(bullet.x - player.x, bullet.y - player.y);
        if (distToPlayer < 20 && bullet.team !== player.team) {
          player.health -= 25;
          if (player.health <= 0) {
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

        if (Math.random() < 0.02) {
          const speed = 6;
          bulletsRef.current.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(enemy.angle) * speed,
            vy: Math.sin(enemy.angle) * speed,
            team: enemy.team,
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

        ctx.fillStyle = p.team === 'blue' ? '#0EA5E9' : '#ea384c';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, -3, 12, 6);

        ctx.restore();

        ctx.fillStyle = p.team === 'blue' ? '#0EA5E9' : '#ea384c';
        ctx.fillRect(p.x - 20, p.y - 25, 40, 4);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(p.x - 20, p.y - 25, (40 * p.health) / 100, 4);
      };

      drawPlayer(player);
      enemiesRef.current.forEach(drawPlayer);

      bulletsRef.current.forEach((bullet) => {
        ctx.fillStyle = bullet.team === 'blue' ? '#60A5FA' : '#F87171';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => cancelAnimationFrame(animationId);
  }, [gameStarted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F1419] p-4">
      <div className="mb-4 flex gap-8 items-center">
        <div className="text-[#0EA5E9] font-bold text-2xl">
          Синие: {score.blue}
        </div>
        <div className="text-white font-bold text-3xl">
          {formatTime(timeLeft)}
        </div>
        <div className="text-[#ea384c] font-bold text-2xl">
          Красные: {score.red}
        </div>
      </div>

      {!gameStarted && (
        <button
          onClick={() => setGameStarted(true)}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold text-2xl px-12 py-6 rounded-lg transition-colors z-10"
        >
          НАЧАТЬ ИГРУ
        </button>
      )}

      <canvas
        ref={canvasRef}
        width={1000}
        height={600}
        className="border-4 border-[#2A3F5C] rounded-lg shadow-2xl"
      />

      <div className="mt-4 text-white/60 text-sm">
        Управление: WASD — движение | Мышь — прицеливание | ЛКМ — выстрел
      </div>
    </div>
  );
};

export default Game;
