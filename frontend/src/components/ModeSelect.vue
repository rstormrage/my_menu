<template>
  <div class="gate">
    <div class="mode-wrap">
      <p class="eyebrow">今天怎么吃</p>
      <h2>先选一个模式</h2>
      <p class="gate-hint">在家开火，或出门找馆子。随时可以再换。</p>
      <div class="mode-grid">
        <button class="mode-card" type="button" @click="$emit('select', 'home')">
          <span class="mode-emoji">🏠</span>
          <strong>在家吃</strong>
          <small>看家里的菜和食谱，点一道或随机决定</small>
        </button>
        <button class="mode-card" type="button" @click="$emit('select', 'out')">
          <span class="mode-emoji">🏮</span>
          <strong>下馆子</strong>
          <small>看附近馆子、必点、距离和花费</small>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['select'])
</script>

<style scoped>
.mode-wrap {
  width: min(720px, 100%);
  text-align: center;
}

.mode-wrap h2 {
  margin: 0 0 8px;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 40px;
  font-weight: 400;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 28px;
}

.mode-card {
  border: 1px solid #eadfcb;
  background: #fffdf8;
  border-radius: 22px;
  padding: 28px 20px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-card:hover {
  border-color: #d4532b;
  transform: translateY(-3px);
  box-shadow: 0 12px 24px rgba(80, 52, 24, 0.08);
}

.mode-emoji {
  font-size: 32px;
}

.mode-card strong {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 28px;
  font-weight: 400;
}

.mode-card small {
  color: #6f6254;
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 700px) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
