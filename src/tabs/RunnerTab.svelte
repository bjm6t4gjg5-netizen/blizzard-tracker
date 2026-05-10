<script lang="ts">
  import { profiles } from '../lib/stores';
  import RunnerTabContent from './RunnerTabContent.svelte';

  export let profileId: string;

  $: profile = $profiles.find(p => p.id === profileId) ?? null;
</script>

{#if profile}
  <RunnerTabContent {profile} />
{:else}
  <div class="card card-pad">Runner not found.</div>
{/if}
