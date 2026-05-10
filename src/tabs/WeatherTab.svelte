<script lang="ts">
  import WeatherPanel from '../components/WeatherPanel.svelte';
</script>

<h2 class="title">Race Day Weather</h2>
<p class="sub">Brooklyn · May 16, 2026 · 7:00 AM ET start</p>
<WeatherPanel />

<style>
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }
</style>
