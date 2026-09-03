<template>
  <LoginGate v-if="!unlocked" @unlocked="onUnlocked" />
  <ModeSelect v-else-if="!mode" @select="selectMode" />
  <div v-else class="app-shell">
    <Sidebar
      :categories="categories"
      :selected-id="selectedCategoryId"
      :subtitle="mode === 'out' ? '出门吃，看距离和花费' : '开火做，按食谱来'"
      :all-label="mode === 'out' ? '全部馆子' : '全部菜品'"
      :add-label="mode === 'out' ? '＋ 新分类' : '＋ 新分类'"
      @select="selectCategory"
      @add="showAddCategory = true"
      @remove="removeCategory"
      @switch-mode="mode = null"
    />

    <main class="stage">
      <header class="hero">
        <div>
          <p class="eyebrow">{{ mode === 'out' ? '下馆子 · 今日一餐' : '在家吃 · 今日一餐' }}</p>
          <h1>{{ mode === 'out' ? '今天去哪吃' : '今天吃什么' }}</h1>
        </div>

        <div class="today-card" :class="{ spinning }">
          <span class="today-label">{{ today?.source === 'random' ? '随机决定' : '今日选定' }}</span>
          <template v-if="mode === 'out'">
            <strong v-if="today?.restaurant_name">
              <span>{{ today.category_emoji }}</span>
              {{ today.restaurant_name }}
            </strong>
            <strong v-else class="empty-pick">还没定，点一家馆子或随机一下</strong>
            <p v-if="today?.restaurant_hits">必点：{{ today.restaurant_hits }}</p>
            <p v-if="today?.restaurant_name">
              离家 {{ formatDistance(today.distance_km) }} · 人均约 ¥{{ today.cost }}
            </p>
          </template>
          <template v-else>
            <strong v-if="today?.dish_name">
              <span>{{ today.category_emoji }}</span>
              {{ today.dish_name }}
            </strong>
            <strong v-else class="empty-pick">还没定，点一道菜或随机一下</strong>
            <p v-if="today?.dish_note">{{ today.dish_note }}</p>
          </template>
        </div>

        <div class="hero-actions">
          <button class="btn primary" :disabled="spinning || !hasItems" @click="randomPick">
            {{ spinning ? '正在摇号…' : randomLabel }}
          </button>
          <button class="btn ghost" @click="openAddItem">
            {{ mode === 'out' ? '添加馆子' : '添加菜品' }}
          </button>
        </div>
      </header>

      <p v-if="error" class="banner">{{ error }}</p>
      <p v-else-if="loading" class="banner muted">正在打开菜单…</p>

      <RestaurantPanel
        v-if="mode === 'out'"
        :restaurants="restaurants"
        :today-id="today?.restaurant_id"
        :category="selectedCategory"
        @choose="chooseRestaurant"
        @remove="removeRestaurant"
        @add="showAddRestaurant = true"
      />
      <DishPanel
        v-else
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
    <AddRestaurantModal
      v-if="showAddRestaurant"
      :categories="categories"
      :default-category-id="selectedCategoryId"
      @close="showAddRestaurant = false"
      @saved="onRestaurantAdded"
    />
    <AddCategoryModal
      v-if="showAddCategory"
      :kind="mode"
      @close="showAddCategory = false"
      @saved="onCategoryAdded"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { api } from './api.js'
import { clearToken, isUnlocked } from './auth.js'
import Sidebar from './components/Sidebar.vue'
import DishPanel from './components/DishPanel.vue'
import RestaurantPanel from './components/RestaurantPanel.vue'
import AddDishModal from './components/AddDishModal.vue'
import AddRestaurantModal from './components/AddRestaurantModal.vue'
import AddCategoryModal from './components/AddCategoryModal.vue'
import LoginGate from './components/LoginGate.vue'
import ModeSelect from './components/ModeSelect.vue'

const unlocked = ref(isUnlocked())
const mode = ref(null)
const categories = ref([])
const dishes = ref([])
const restaurants = ref([])
const today = ref(null)
const selectedCategoryId = ref(null)
const loading = ref(false)
const spinning = ref(false)
const error = ref('')
const showAddDish = ref(false)
const showAddRestaurant = ref(false)
const showAddCategory = ref(false)

const selectedCategory = computed(
  () => categories.value.find((c) => c.id === selectedCategoryId.value) || null,
)

const hasItems = computed(() =>
  mode.value === 'out' ? restaurants.value.length > 0 : dishes.value.length > 0,
)

const randomLabel = computed(() => {
  if (selectedCategory.value) {
    return mode.value === 'out'
      ? `在「${selectedCategory.value.name}」里随机`
      : `在「${selectedCategory.value.name}」里随机`
  }
  return mode.value === 'out' ? '全部随机' : '全部随机'
})

function formatDistance(value) {
  const km = Number(value)
  if (!Number.isFinite(km)) return '未知'
  if (km < 1) return `${Math.round(km * 1000)} 米`
  return `${km} 公里`
}

function openAddItem() {
  if (mode.value === 'out') showAddRestaurant.value = true
  else showAddDish.value = true
}

async function loadAll() {
  if (!mode.value) return
  loading.value = true
  error.value = ''
  selectedCategoryId.value = null
  categories.value = []
  dishes.value = []
  restaurants.value = []
  today.value = null
  try {
    const [cats, items, pick] = await Promise.all([
      api.categories(mode.value),
      mode.value === 'out' ? api.restaurants() : api.dishes(),
      api.today(mode.value),
    ])
    categories.value = cats
    if (mode.value === 'out') {
      restaurants.value = items
      dishes.value = []
    } else {
      dishes.value = items
      restaurants.value = []
    }
    today.value = pick
  } catch (err) {
    if (err.message === '请先登录') {
      clearToken()
      unlocked.value = false
      mode.value = null
      return
    }
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  if (mode.value === 'out') {
    restaurants.value = await api.restaurants(selectedCategoryId.value)
  } else {
    dishes.value = await api.dishes(selectedCategoryId.value)
  }
}

async function loadCategories() {
  categories.value = await api.categories(mode.value)
}

function selectMode(nextMode) {
  mode.value = nextMode
  loadAll()
}

function selectCategory(id) {
  selectedCategoryId.value = id
  loadItems().catch((err) => {
    error.value = err.message
  })
}

async function chooseDish(dish) {
  error.value = ''
  try {
    today.value = await api.pickToday({ mode: 'home', dish_id: dish.id })
  } catch (err) {
    error.value = err.message
  }
}

async function chooseRestaurant(shop) {
  error.value = ''
  try {
    today.value = await api.pickToday({ mode: 'out', restaurant_id: shop.id })
  } catch (err) {
    error.value = err.message
  }
}

async function randomPick() {
  error.value = ''
  spinning.value = true
  try {
    today.value = await api.randomToday({
      mode: mode.value,
      category_id: selectedCategoryId.value,
    })
    await new Promise((r) => setTimeout(r, 420))
  } catch (err) {
    error.value = err.message
  } finally {
    spinning.value = false
  }
}

async function onDishAdded() {
  showAddDish.value = false
  await Promise.all([loadItems(), loadCategories()])
}

async function onRestaurantAdded() {
  showAddRestaurant.value = false
  await Promise.all([loadItems(), loadCategories()])
}

async function onCategoryAdded() {
  showAddCategory.value = false
  await loadCategories()
}

async function removeDish(dish) {
  if (!confirm(`删除「${dish.name}」？`)) return
  await api.deleteDish(dish.id)
  if (today.value?.dish_id === dish.id) today.value = null
  await Promise.all([loadItems(), loadCategories()])
}

async function removeRestaurant(shop) {
  if (!confirm(`删除馆子「${shop.name}」？`)) return
  await api.deleteRestaurant(shop.id)
  if (today.value?.restaurant_id === shop.id) today.value = null
  await Promise.all([loadItems(), loadCategories()])
}

async function removeCategory(cat) {
  const label = mode.value === 'out' ? '及其中全部馆子' : '及其中全部菜品'
  if (!confirm(`删除分类「${cat.name}」${label}？`)) return
  await api.deleteCategory(cat.id)
  if (selectedCategoryId.value === cat.id) selectedCategoryId.value = null
  await loadAll()
}

function onUnlocked() {
  unlocked.value = true
}
</script>
