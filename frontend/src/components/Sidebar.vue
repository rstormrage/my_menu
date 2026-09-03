<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="mark">筷</span>
      <div>
        <strong>我的菜单</strong>
        <small>{{ subtitle }}</small>
      </div>
    </div>

    <nav>
      <button class="cat" :class="{ active: selectedId == null }" @click="$emit('select', null)">
        <span class="emoji">🍽️</span>
        <span class="name">{{ allLabel }}</span>
      </button>

      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat"
        :class="{ active: selectedId === cat.id }"
        @click="$emit('select', cat.id)"
      >
        <span class="emoji">{{ cat.emoji }}</span>
        <span class="name">{{ cat.name }}</span>
        <span class="count">{{ cat.dish_count }}</span>
        <span
          class="kill"
          title="删除分类"
          @click.stop="$emit('remove', cat)"
        >×</span>
      </button>
    </nav>

    <button class="add-cat" @click="$emit('add')">{{ addLabel }}</button>
    <button class="mode-back" @click="$emit('switch-mode')">← 换个计划</button>
  </aside>
</template>

<script setup>
defineProps({
  categories: { type: Array, default: () => [] },
  selectedId: { type: Number, default: null },
  subtitle: { type: String, default: '按心情挑，或交给运气' },
  allLabel: { type: String, default: '全部菜品' },
  addLabel: { type: String, default: '＋ 新分类' },
})

defineEmits(['select', 'add', 'remove', 'switch-mode'])
</script>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #243128 0%, #1a231c 100%);
  color: #f4ead5;
  display: flex;
  flex-direction: column;
  padding: 28px 18px 20px;
  min-height: 100vh;
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 28px;
  padding: 0 8px;
}

.mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #d4532b;
  display: grid;
  place-items: center;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 22px;
}

.brand strong {
  display: block;
  font-size: 18px;
  letter-spacing: 0.04em;
}

.brand small {
  color: #c9b89a;
  font-size: 12px;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.cat {
  display: grid;
  grid-template-columns: 28px 1fr auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  color: #e8dcc6;
  text-align: left;
  padding: 10px 10px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
}

.cat:hover {
  background: rgba(255, 255, 255, 0.06);
}

.cat.active {
  background: #f7f1e8;
  color: #1f1a16;
}

.emoji {
  font-size: 16px;
}

.name {
  font-size: 15px;
}

.count {
  font-size: 12px;
  opacity: 0.6;
}

.kill {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: none;
  place-items: center;
  font-size: 14px;
  opacity: 0.55;
}

.cat:hover .kill {
  display: grid;
}

.add-cat {
  margin-top: 12px;
  border: 1px dashed rgba(244, 234, 213, 0.35);
  background: transparent;
  color: #e8dcc6;
  border-radius: 12px;
  padding: 10px;
  cursor: pointer;
  font: inherit;
}

.add-cat:hover {
  border-color: #d4532b;
  color: #fff;
}

.mode-back {
  margin-top: 8px;
  border: 0;
  background: transparent;
  color: #c9b89a;
  padding: 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.mode-back:hover {
  color: #fff;
}
</style>
