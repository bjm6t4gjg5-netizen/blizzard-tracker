<script lang="ts">
  /** Venmo handle. Defaults to the runners' shared account; pass `user` to
      override (e.g. "leonschulte" for the dev tip jar). */
  export let user = 'Catherine-Blizzard';

  export let variant: 'primary' | 'pill' | 'ghost' = 'primary';
  export let label = '🍺 Venmo a beer';
  /** Optional pre-filled note shown when the user opens the Venmo page. */
  export let note = 'Race-day beer for the Blizzards 🏃‍♀️⚡';

  $: href = `https://venmo.com/u/${user}?txn=pay&note=${encodeURIComponent(note)}`;
</script>

<a class="venmo venmo-{variant}" {href} target="_blank" rel="noopener noreferrer">
  <span class="handle">{label}</span>
  <span class="user mono">@{user}</span>
</a>

<style>
  .venmo {
    --venmo: #3D95CE;
    --venmo-deep: #2A7DAF;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: transform 80ms ease, background 100ms ease;
    border-radius: var(--radius-sm);
    line-height: 1;
  }
  .venmo:hover { transform: translateY(-1px); text-decoration: none; }
  .handle { white-space: nowrap; }
  .user { font-size: 11px; opacity: 0.8; }

  .venmo-primary {
    padding: 10px 16px;
    background: var(--venmo);
    color: white;
    font-weight: 700;
    font-size: 13px;
    box-shadow: var(--shadow-sm);
  }
  .venmo-primary:hover { background: var(--venmo-deep); }
  .venmo-primary .user { color: rgba(255, 255, 255, 0.85); }

  .venmo-pill {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--separator-soft);
    color: var(--venmo);
    font-weight: 600;
    font-size: 11px;
  }
  .venmo-pill:hover { border-color: var(--venmo); background: rgba(61, 149, 206, 0.06); }
  .venmo-pill .user { color: var(--text-tertiary); font-size: 10px; }

  .venmo-ghost {
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--venmo);
    color: var(--venmo);
    font-weight: 700;
    font-size: 13px;
  }
  .venmo-ghost:hover { background: rgba(61, 149, 206, 0.08); }
  .venmo-ghost .user { color: var(--text-tertiary); }
</style>
