<template>
  <section class="panel">
    <div class="panel-head">
      <h2>{{ category ? `${category.emoji} ${category.name}` : '全部馆子' }}</h2>
      <span>{{ restaurants.length }} 家</span>
    </div>

    <div v-if="!restaurants.length" class="empty">
      <p>还没有馆子。</p>
      <button class="btn primary" @click="$emit('add')">先加一家馆子</button>
    </div>

    <div v-else class="grid">
      <article
        v-for="shop in restaurants"
        :key="shop.id"
        class="card"
        :class="{ chosen: todayId === shop.id }"
        role="button"
        tabindex="0"
        @click="$emit('choose', shop)"
        @keydown.enter="$emit('choose', shop)"
      >
        <div class="card-top">
          <span class="chip">{{ shop.category_emoji }} {{ shop.category_name }}</span>
          <button class="icon-btn" title="删除" @click.stop="$emit('remove', shop)">删除</button>
        </div>
        <h3>{{ shop.name }}</h3>
        <p class="hits">必点：{{ shop.hits || '还没记下好吃的菜' }}</p>
        <div class="meta">
          <span>离家 {{ formatDistance(shop.distance_km) }}</span>
          <span>人均约 ¥{{ shop.cost }}</span>
        </div>
        <p v-if="shop.note" class="note">{{ shop.note }}</p>
        <em v-if="todayId === shop.id">今日已选</em>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  restaurants: { type: Array, default: () => [] },
  todayId: { type: Number, default: null },
  category: { type: Object, default: null },
})

defineEmits(['choose', 'remove', 'add'])

function formatDistance(value) {
  const km = Number(value)
  if (!Number.isFinite(km)) return '未知'
  if (km < 1) return `${Math.round(km * 1000)} 米`
  return `${km} 公里`
}
</script>

<style scoped>
.panel {
  padding: 8px 8px 40px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 18px;
}

.panel-head h2 {
  margin: 0;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 28px;
  font-weight: 400;
}

.panel-head span {
  color: #8a7b68;
}

.empty {
  background: #fffdf8;
  border: 1px dashed #d9cbb3;
  border-radius: 18px;
  padding: 48px;
  text-align: center;
  color: #6f6254;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.card {
  background: #fffdf8;
  border: 1px solid #eadfcb;
  border-radius: 18px;
  padding: 16px 16px 18px;
  cursor: pointer;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 24px rgba(80, 52, 24, 0.08);
}

.card.chosen {
  border-color: #d4532b;
  box-shadow: 0 0 0 3px rgba(212, 83, 43, 0.15);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chip {
  font-size: 12px;
  color: #6f6254;
  background: #f4ead5;
  border-radius: 999px;
  padding: 3px 8px;
}

.icon-btn {
  border: 0;
  background: transparent;
  color: #b09a82;
  cursor: pointer;
  font-size: 12px;
}

h3 {
  margin: 4px 0 0;
  font-size: 20px;
  font-family: 'ZCOOL XiaoWei', serif;
  font-weight: 400;
}

.hits,
.note {
  margin: 0;
  color: #6f6254;
  font-size: 13px;
  line-height: 1.5;
}

.hits {
  flex: 1;
}

.meta {
  display: flex;
  gap: 12px;
  color: #d4532b;
  font-size: 13px;
}

em {
  font-style: normal;
  color: #d4532b;
  font-size: 12px;
  letter-spacing: 0.08em;
}
</style>
