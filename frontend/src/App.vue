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
        :restaurants="visibleRestaurants"
        :today-id="today?.restaurant_id"
        :category="selectedCategory"
        @choose="chooseRestaurant"
        @remove="removeRestaurant"
        @add="showAddRestaurant = true"
      />
      <DishPanel
        v-else
        :dishes="visibleDishes"
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
const homeCategories = ref([])
const outCategories = ref([])
const allDishes = ref([])
const allRestaurants = ref([])
const todayHome = ref(null)
const todayOut = ref(null)
const selectedCategoryId = ref(null)
const loading = ref(false)
const spinning = ref(false)
const error = ref('')
const showAddDish = ref(false)
const showAddRestaurant = ref(false)
const showAddCategory = ref(false)
const catalogLoaded = ref(false)
let catalogPromise = null

const categories = computed(() =>
  mode.value === 'out' ? outCategories.value : homeCategories.value,
)

const selectedCategory = computed(
  () => categories.value.find((c) => c.id === selectedCategoryId.value) || null,
)

const visibleDishes = computed(() => {
  const list = allDishes.value
  if (!selectedCategoryId.value) return list
  return list.filter((d) => Number(d.category_id) === Number(selectedCategoryId.value))
})

const visibleRestaurants = computed(() => {
  const list = allRestaurants.value
  if (!selectedCategoryId.value) return list
  return list.filter((r) => Number(r.category_id) === Number(selectedCategoryId.value))
})

const today = computed(() => (mode.value === 'out' ? todayOut.value : todayHome.value))

const hasItems = computed(() =>
  mode.value === 'out' ? visibleRestaurants.value.length > 0 : visibleDishes.value.length > 0,
)

const randomLabel = computed(() => {
  if (selectedCategory.value) return `在「${selectedCategory.value.name}」里随机`
  return '全部随机'
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

function handleAuthError(err) {
  if (err.message === '请先登录') {
    clearToken()
    unlocked.value = false
    mode.value = null
    catalogLoaded.value = false
    return true
  }
  return false
}

async function fetchCatalog({ silent = false } = {}) {
  if (!silent) loading.value = true
  error.value = ''
  const request = Promise.all([
    api.categories('home'),
    api.categories('out'),
    api.dishes(),
    api.restaurants(),
    api.today('home'),
    api.today('out'),
  ])
  catalogPromise = request
  try {
    const [homeCats, outCats, dishes, restaurants, homePick, outPick] = await request
    homeCategories.value = homeCats
    outCategories.value = outCats
    allDishes.value = dishes
    allRestaurants.value = restaurants
    todayHome.value = homePick
    todayOut.value = outPick
    catalogLoaded.value = true
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  } finally {
    if (!silent) loading.value = false
    if (catalogPromise === request) catalogPromise = null
  }
}

function loadCatalog() {
  if (catalogLoaded.value) return
  if (catalogPromise) return catalogPromise
  return fetchCatalog()
}

function refreshCatalog() {
  return fetchCatalog({ silent: true })
}

function selectMode(nextMode) {
  mode.value = nextMode
  selectedCategoryId.value = null
  if (!catalogLoaded.value) loadCatalog()
}

function selectCategory(id) {
  selectedCategoryId.value = id
}

async function chooseDish(dish) {
  error.value = ''
  try {
    todayHome.value = await api.pickToday({ mode: 'home', dish_id: dish.id })
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  }
}

async function chooseRestaurant(shop) {
  error.value = ''
  try {
    todayOut.value = await api.pickToday({ mode: 'out', restaurant_id: shop.id })
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  }
}

async function randomPick() {
  error.value = ''
  const pool = mode.value === 'out' ? visibleRestaurants.value : visibleDishes.value
  if (!pool.length) return
  spinning.value = true
  try {
    const item = pool[Math.floor(Math.random() * pool.length)]
    if (mode.value === 'out') {
      const pick = await api.pickToday({ mode: 'out', restaurant_id: item.id })
      todayOut.value = { ...pick, source: 'random' }
    } else {
      const pick = await api.pickToday({ mode: 'home', dish_id: item.id })
      todayHome.value = { ...pick, source: 'random' }
    }
    await new Promise((r) => setTimeout(r, 420))
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  } finally {
    spinning.value = false
  }
}

async function onDishAdded() {
  showAddDish.value = false
  await refreshCatalog()
}

async function onRestaurantAdded() {
  showAddRestaurant.value = false
  await refreshCatalog()
}

async function onCategoryAdded() {
  showAddCategory.value = false
  await refreshCatalog()
}

async function removeDish(dish) {
  if (!confirm(`删除「${dish.name}」？`)) return
  try {
    await api.deleteDish(dish.id)
    if (todayHome.value?.dish_id === dish.id) todayHome.value = null
    await refreshCatalog()
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  }
}

async function removeRestaurant(shop) {
  if (!confirm(`删除馆子「${shop.name}」？`)) return
  try {
    await api.deleteRestaurant(shop.id)
    if (todayOut.value?.restaurant_id === shop.id) todayOut.value = null
    await refreshCatalog()
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  }
}

async function removeCategory(cat) {
  const label = mode.value === 'out' ? '及其中全部馆子' : '及其中全部菜品'
  if (!confirm(`删除分类「${cat.name}」${label}？`)) return
  try {
    await api.deleteCategory(cat.id)
    if (selectedCategoryId.value === cat.id) selectedCategoryId.value = null
    await refreshCatalog()
  } catch (err) {
    if (handleAuthError(err)) return
    error.value = err.message
  }
}

function onUnlocked() {
  unlocked.value = true
  loadCatalog()
}

if (unlocked.value) {
  loadCatalog()
}
</script>
