import { seedCategories, seedDishes } from './seed.js'

const KEY = 'my-menu-v1'

function todayDate() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function createSeed() {
  const categories = seedCategories.map((c, i) => ({
    id: i + 1,
    name: c.name,
    emoji: c.emoji,
    sort_order: c.sort_order,
    created_at: new Date().toISOString(),
  }))
  const idByName = Object.fromEntries(categories.map((c) => [c.name, c.id]))
  const dishes = seedDishes
    .filter((d) => idByName[d.category])
    .map((d, i) => ({
      id: i + 1,
      name: d.name,
      note: d.note,
      category_id: idByName[d.category],
      created_at: new Date().toISOString(),
    }))
  return {
    categories,
    dishes,
    picks: [],
    nextCategoryId: categories.length + 1,
    nextDishId: dishes.length + 1,
    nextPickId: 1,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* use seed */
  }
  const db = createSeed()
  save(db)
  return db
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

function withCat(db, dish) {
  const c = db.categories.find((x) => x.id === dish.category_id)
  return {
    id: dish.id,
    name: dish.name,
    note: dish.note,
    created_at: dish.created_at,
    category_id: dish.category_id,
    category_name: c?.name || '',
    category_emoji: c?.emoji || '🍽️',
  }
}

function pickView(db, pick) {
  if (!pick) return null
  const dish = db.dishes.find((d) => d.id === pick.dish_id)
  if (!dish) {
    return {
      id: pick.id,
      pick_date: pick.pick_date,
      source: pick.source,
      dish_id: null,
      dish_name: null,
      dish_note: null,
      category_name: null,
      category_emoji: null,
    }
  }
  const c = db.categories.find((x) => x.id === dish.category_id)
  return {
    id: pick.id,
    pick_date: pick.pick_date,
    source: pick.source,
    dish_id: dish.id,
    dish_name: dish.name,
    dish_note: dish.note,
    category_name: c?.name,
    category_emoji: c?.emoji,
  }
}

function savePick(dishId, source) {
  const db = load()
  if (!db.dishes.some((d) => d.id === dishId)) {
    return Promise.reject(new Error('请选择一道菜'))
  }
  const date = todayDate()
  let pick = db.picks.find((p) => p.pick_date === date)
  if (pick) {
    pick.dish_id = dishId
    pick.source = source
  } else {
    pick = { id: db.nextPickId++, dish_id: dishId, pick_date: date, source }
    db.picks.push(pick)
  }
  save(db)
  return Promise.resolve(pickView(db, pick))
}

export const localApi = {
  categories() {
    const db = load()
    return Promise.resolve(
      db.categories
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((c) => ({
          ...c,
          dish_count: db.dishes.filter((d) => d.category_id === c.id).length,
        })),
    )
  },
  addCategory({ name, emoji }) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return Promise.reject(new Error('分类名称不能为空'))
    const db = load()
    if (db.categories.some((c) => c.name === trimmed)) {
      return Promise.reject(new Error('这个分类已经存在'))
    }
    const row = {
      id: db.nextCategoryId++,
      name: trimmed,
      emoji: String(emoji || '🍽️').trim() || '🍽️',
      sort_order: Math.max(0, ...db.categories.map((c) => c.sort_order)) + 1,
      created_at: new Date().toISOString(),
    }
    db.categories.push(row)
    save(db)
    return Promise.resolve({ ...row, dish_count: 0 })
  },
  deleteCategory(id) {
    const db = load()
    const cid = Number(id)
    db.categories = db.categories.filter((c) => c.id !== cid)
    db.dishes = db.dishes.filter((d) => d.category_id !== cid)
    save(db)
    return Promise.resolve({ ok: true })
  },
  dishes(categoryId) {
    const db = load()
    let list = db.dishes
    if (categoryId) list = list.filter((d) => d.category_id === Number(categoryId))
    list = list
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id)
    return Promise.resolve(list.map((d) => withCat(db, d)))
  },
  addDish({ name, note, category_id }) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return Promise.reject(new Error('菜品名称不能为空'))
    const cid = Number(category_id)
    if (!cid) return Promise.reject(new Error('请选择分类'))
    const db = load()
    if (!db.categories.some((c) => c.id === cid)) {
      return Promise.reject(new Error('请选择分类'))
    }
    const row = {
      id: db.nextDishId++,
      name: trimmed,
      note: String(note || '').trim(),
      category_id: cid,
      created_at: new Date().toISOString(),
    }
    db.dishes.push(row)
    save(db)
    return Promise.resolve(withCat(db, row))
  },
  deleteDish(id) {
    const db = load()
    db.dishes = db.dishes.filter((d) => d.id !== Number(id))
    save(db)
    return Promise.resolve({ ok: true })
  },
  today() {
    const db = load()
    const pick = db.picks.find((p) => p.pick_date === todayDate())
    return Promise.resolve(pickView(db, pick))
  },
  pickToday(dish_id) {
    return savePick(Number(dish_id), 'manual')
  },
  randomToday(category_id) {
    const db = load()
    let pool = db.dishes
    if (category_id) pool = pool.filter((d) => d.category_id === Number(category_id))
    if (!pool.length) return Promise.reject(new Error('这个分类还没有菜品'))
    const dish = pool[Math.floor(Math.random() * pool.length)]
    return savePick(dish.id, 'random')
  },
}
