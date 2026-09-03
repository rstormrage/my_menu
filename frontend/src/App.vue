<template>
  <div class="app-shell">
    <Sidebar
      :categories="categories"
      :selected-id="selectedCategoryId"
      @select="selectCategory"
      @add="showAddCategory = true"
      @remove="removeCategory"
    />

    <main class="stage">
      <header class="hero">
        <div>
          <p class="eyebrow">个人菜单 · 今日一餐</p>
          <h1>今天吃什么</h1>
        </div>

        <div class="today-card" :class="{ spinning }">
          <span class="today-label">{{ today?.source === 'random' ? '随机决定' : '今日选定' }}</span>
          <strong v-if="today?.dish_name">
            <span>{{ today.category_emoji }}</span>
            {{ today.dish_name }}
          </strong>
          <strong v-else class="empty-pick">还没定，点一道菜或随机一下</strong>
          <p v-if="today?.dish_note">{{ today.dish_note }}</p>
        </div>

        <div class="hero-actions">
          <button class="btn primary" :disabled="spinning || !dishes.length" @click="randomPick">
            {{ spinning ? '正在摇号…' : selectedCategory ? `在「${selectedCategory.name}」里随机` : '全部随机' }}
          </button>
          <button class="btn ghost" @click="showAddDish = true">添加菜品</button>
        </div>
      </header>

      <p v-if="error" class="banner">{{ error }}</p>
      <p v-else-if="loading" class="banner muted">正在打开菜单…</p>

      <DishPanel
        :dishes="dishes"
        :today-id="today?.dish_id"
        :category="selectedCategory"
        @choose="chooseDish"
        @remove="removeDish"
        @add="showAddDish = true"
      />
    </main>

    <AddDishModal
      v-if="showAddDish"
      :categories="categories"
      :default-category-id="selectedCategoryId"
      @close="showAddDish = false"
      @saved="onDishAdded"
    />
    <AddCategoryModal
      v-if="showAddCategory"
      @close="showAddCategory = false"
      @saved="onCategoryAdded"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from './api.js'
import Sidebar from './components/Sidebar.vue'
import DishPanel from './components/DishPanel.vue'
import AddDishModal from './components/AddDishModal.vue'
import AddCategoryModal from './components/AddCategoryModal.vue'

const categories = ref([])
const dishes = ref([])
const today = ref(null)
const selectedCategoryId = ref(null)
const loading = ref(true)
const spinning = ref(false)
const error = ref('')
const showAddDish = ref(false)
const showAddCategory = ref(false)

const selectedCategory = computed(
  () => categories.value.find((c) => c.id === selectedCategoryId.value) || null,
)

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [cats, dishList, pick] = await Promise.all([
      api.categories(),
      api.dishes(selectedCategoryId.value),
      api.today(),
    ])
    categories.value = cats
    dishes.value = dishList
    today.value = pick
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadDishes() {
  dishes.value = await api.dishes(selectedCategoryId.value)
}

async function loadCategories() {
  categories.value = await api.categories()
}

function selectCategory(id) {
  selectedCategoryId.value = id
  loadDishes().catch((err) => {
    error.value = err.message
  })
}

async function chooseDish(dish) {
  error.value = ''
  try {
    today.value = await api.pickToday(dish.id)
  } catch (err) {
    error.value = err.message
  }
}

async function randomPick() {
  error.value = ''
  spinning.value = true
  try {
    today.value = await api.randomToday(selectedCategoryId.value)
    await new Promise((r) => setTimeout(r, 420))
  } catch (err) {
    error.value = err.message
  } finally {
    spinning.value = false
  }
}

async function onDishAdded() {
  showAddDish.value = false
  await Promise.all([loadDishes(), loadCategories()])
}

async function onCategoryAdded() {
  showAddCategory.value = false
  await loadCategories()
}

async function removeDish(dish) {
  if (!confirm(`删除「${dish.name}」？`)) return
  await api.deleteDish(dish.id)
  if (today.value?.dish_id === dish.id) today.value = null
  await Promise.all([loadDishes(), loadCategories()])
}

async function removeCategory(cat) {
  if (!confirm(`删除分类「${cat.name}」及其中全部菜品？`)) return
  await api.deleteCategory(cat.id)
  if (selectedCategoryId.value === cat.id) selectedCategoryId.value = null
  await loadAll()
}

onMounted(loadAll)
</script>
