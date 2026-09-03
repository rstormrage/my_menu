<template>
  <section class="panel">
    <div class="panel-head">
      <h2>{{ category ? `${category.emoji} ${category.name}` : '全部菜品' }}</h2>
      <span>{{ dishes.length }} 道</span>
    </div>

    <div v-if="!dishes.length" class="empty">
      <p>这一栏还是空的。</p>
      <button class="btn primary" @click="$emit('add')">先加一道菜</button>
    </div>

    <div v-else class="grid">
      <article
        v-for="dish in dishes"
        :key="dish.id"
        class="card"
        :class="{ chosen: todayId === dish.id }"
        role="button"
        tabindex="0"
        @click="$emit('choose', dish)"
        @keydown.enter="$emit('choose', dish)"
      >
        <div class="card-top">
          <span class="chip">{{ dish.category_emoji }} {{ dish.category_name }}</span>
          <button class="icon-btn" title="删除" @click.stop="$emit('remove', dish)">删除</button>
        </div>
        <h3>{{ dish.name }}</h3>
        <p>{{ dish.note || '点一下，今天就吃这个' }}</p>
        <em v-if="todayId === dish.id">今日已选</em>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  dishes: { type: Array, default: () => [] },
  todayId: { type: Number, default: null },
  category: { type: Object, default: null },
})

defineEmits(['choose', 'remove', 'add'])
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.card {
  background: #fffdf8;
  border: 1px solid #eadfcb;
  border-radius: 18px;
  padding: 16px 16px 18px;
  cursor: pointer;
  min-height: 150px;
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

p {
  margin: 0;
  color: #6f6254;
  font-size: 13px;
  line-height: 1.5;
  flex: 1;
}

em {
  font-style: normal;
  color: #d4532b;
  font-size: 12px;
  letter-spacing: 0.08em;
}
</style>
