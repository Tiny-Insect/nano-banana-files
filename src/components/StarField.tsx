import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  opacity: number;
  vx: number;
  vy: number;
  phase: number;
  drift: number;
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = 0, h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const initParticles = () => {
      const count = Math.floor((w * h) / 5000);
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        opacity: Math.random() * 0.5 + 0.15,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.15 - 0.1, // slight upward drift
        phase: Math.random() * Math.PI * 2,
        drift: Math.random() * 0.8 + 0.3,
      }));
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    let t = 0;
    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.classList.contains("dark");

      for (const p of particlesRef.current) {
        // Organic floating motion
        p.x += p.vx + Math.sin(t * p.drift + p.phase) * 0.25;
        p.y += p.vy + Math.cos(t * p.drift * 0.7 + p.phase) * 0.15;

        // Subtle mouse repulsion
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (mx >= 0) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const force = (120 - dist) / 120 * 0.4;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Twinkle
        const twinkle = Math.sin(t * 3 * p.drift + p.phase) * 0.25 + 0.75;
        const a = p.opacity * twinkle;

        if (isDark) {
          ctx.fillStyle = `rgba(200,210,230,${a * 0.65})`;
        } else {
          // Darker particles on light bg for visibility
          ctx.fillStyle = `rgba(90,100,130,${a * 0.5})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
