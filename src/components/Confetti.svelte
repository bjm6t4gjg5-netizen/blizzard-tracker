<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { profiles, runnerState, notify } from '../lib/stores';
  import { load, save } from '../lib/storage';

  // Persist across reloads so a F5 mid-race doesn't blast confetti again.
  const celebrated = new Set<string>(load<string[]>('confettiCelebrated', []));
  function markCelebrated(id: string) {
    celebrated.add(id);
    save('confettiCelebrated', [...celebrated]);
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf: number | null = null;
  let particles: Particle[] = [];
  let resizeHandler: () => void;

  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    size: number;
    color: string;
    rotation: number;
    spin: number;
    age: number;
    life: number;
  }

  const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#FF2D55'];

  function spawn(burst = 120, originColor?: string) {
    const W = canvas.width;
    for (let i = 0; i < burst; i++) {
      particles.push({
        x: W / 2 + (Math.random() - 0.5) * 80,
        y: -20 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 8,
        vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 7,
        color: originColor && Math.random() < 0.4
          ? originColor
          : COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.4,
        age: 0,
        life: 4500 + Math.random() * 2500,
      });
    }
    if (raf == null) tick(performance.now());
  }

  let lastT = 0;
  function tick(t: number) {
    if (!ctx || !canvas) return;
    const dt = lastT ? Math.min(t - lastT, 50) : 16;
    lastT = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.age += dt;
      p.vy += 0.18; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      const opacity = Math.max(0, 1 - p.age / p.life);
      if (opacity <= 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
      ctx.restore();
    }

    particles = particles.filter(p => p.age < p.life && p.y < canvas.height + 50);
    if (particles.length > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      lastT = 0;
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    resizeHandler = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      if (ctx) ctx.scale(dpr, dpr);
    };
    resizeHandler();
    window.addEventListener('resize', resizeHandler);

    // Subscribe to every runner's state and listen for "just finished" transitions.
    const unsubs: Array<() => void> = [];
    for (const p of $profiles) {
      const store = runnerState(p.id);
      let prev = '';
      unsubs.push(store.subscribe(s => {
        if (s.status === 'finished' && prev !== 'finished' && !celebrated.has(p.id)) {
          markCelebrated(p.id);
          spawn(150, p.color);
          notify(`${p.emoji} ${p.name.split(' ')[0]} finished! 🎉`);
        }
        prev = s.status;
      }));
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
      for (const u of unsubs) u();
    };
  });

  onDestroy(() => {
    if (raf != null) cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1500;
  }
</style>
