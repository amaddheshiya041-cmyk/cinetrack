// Premium physics-based Canvas Confetti helper for CineTrack
export function triggerConfetti() {
  // Check if document exists (safe for server-side environments)
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const colors = [
    "#3b82f6", // elegant blue
    "#10b981", // vibrant emerald
    "#f59e0b", // warm amber
    "#ef4444", // soft rose/red
    "#ec4899", // sweet pink
    "#8b5cf6", // premium violet
    "#06b6d4"  // cyan
  ];

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };

  window.addEventListener("resize", handleResize);

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
  }

  const particles: Particle[] = [];
  const burstCount = 140;

  // Pop from slightly below center, shooting upwards & outwards
  for (let i = 0; i < burstCount; i++) {
    const angle = (Math.random() * Math.PI * 1.2) - (Math.PI * 1.1); // shoot mostly up
    const speed = Math.random() * 22 + 8;
    particles.push({
      x: width / 2,
      y: height * 0.7,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      size: Math.random() * 10 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      opacity: 1,
    });
  }

  let animationFrameId: number;
  const gravity = 0.45;
  const drag = 0.975;

  function update() {
    ctx.clearRect(0, 0, width, height);
    let alive = false;

    for (const p of particles) {
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      // Slowly fade out as particles start to fall downwards
      if (p.vy > 1) {
        p.opacity -= 0.012;
      }

      if (p.opacity > 0 && p.y < height + 50) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        
        // Draw elegant confetti rectangle shape
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 1.6);
        ctx.restore();
      }
    }

    if (alive) {
      animationFrameId = requestAnimationFrame(update);
    } else {
      window.removeEventListener("resize", handleResize);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  update();
}
