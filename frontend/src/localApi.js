import {
  seedCategories,
  seedDishes,
  seedRestaurantCategories,
  seedRestaurants,
} from './seed.js'

const KEY = 'my-menu-v2'

function todayDate() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function seedKindCategories(list) {
  return list.map((c, i) => ({
    id: i + 1,
    name: c.name,
    emoji: c.emoji,
    sort_order: c.sort_order,
    kind: list === seedRestaurantCategories ? 'out' : 'home',
    created_at: new Date().toISOString(),
  }))
}

function createSeed() {
  const homeCats = seedKindCategories(seedCategories)
  const outCats = seedRestaurantCategories.map((c, i) => ({
    id: homeCats.length + i + 1,
    name: c.name,
    emoji: c.emoji,
    sort_order: c.sort_order,
    kind: 'out',
    created_at: new Date().toISOString(),
  }))
  const categories = [...homeCats, ...outCats]
  const homeIdByName = Object.fromEntries(homeCats.map((c) => [c.name, c.id]))
  const outIdByName = Object.fromEntries(outCats.map((c) => [c.name, c.id]))
  const dishes = seedDishes
    .filter((d) => homeIdByName[d.category])
    .map((d, i) => ({
      id: i + 1,
      name: d.name,
      note: d.note,
      recipe: d.recipe || '',
      category_id: homeIdByName[d.category],
      created_at: new Date().toISOString(),
    }))
  const restaurants = seedRestaurants
    .filter((r) => outIdByName[r.category])
    .map((r, i) => ({
      id: i + 1,
      name: r.name,
      hits: r.hits,
      distance_km: r.distance_km,
      cost: r.cost,
      note: r.note,
      category_id: outIdByName[r.category],
      created_at: new Date().toISOString(),
    }))
  return {
    categories,
    dishes,
    restaurants,
    picks: [],
    nextCategoryId: categories.length + 1,
    nextDishId: dishes.length + 1,
    nextRestaurantId: restaurants.length + 1,
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
    recipe: dish.recipe || '',
    created_at: dish.created_at,
    category_id: dish.category_id,
    category_name: c?.name || '',
    category_emoji: c?.emoji || '🍽️',
  }
}

function withRestaurantCat(db, restaurant) {
  const c = db.categories.find((x) => x.id === restaurant.category_id)
  return {
    id: restaurant.id,
    name: restaurant.name,
    hits: restaurant.hits || '',
    distance_km: restaurant.distance_km,
    cost: restaurant.cost,
    note: restaurant.note || '',
    created_at: restaurant.created_at,
    category_id: restaurant.category_id,
    category_name: c?.name || '',
    category_emoji: c?.emoji || '🍽️',
  }
}

function pickView(db, pick) {
  if (!pick) return null
  if (pick.mode === 'out') {
    const restaurant = db.restaurants.find((r) => r.id === pick.restaurant_id)
    const c = restaurant && db.categories.find((x) => x.id === restaurant.category_id)
    return {
      id: pick.id,
      pick_date: pick.pick_date,
      source: pick.source,
      mode: 'out',
      dish_id: null,
      restaurant_id: restaurant?.id || null,
      restaurant_name: restaurant?.name || null,
      restaurant_hits: restaurant?.hits || null,
      distance_km: restaurant?.distance_km,
      cost: restaurant?.cost,
      restaurant_note: restaurant?.note || null,
      category_name: c?.name,
      category_emoji: c?.emoji,
    }
  }
  const dish = db.dishes.find((d) => d.id === pick.dish_id)
  const c = dish && db.categories.find((x) => x.id === dish.category_id)
  return {
    id: pick.id,
    pick_date: pick.pick_date,
    source: pick.source,
    mode: 'home',
    dish_id: dish?.id || null,
    dish_name: dish?.name || null,
    dish_note: dish?.note || null,
    dish_recipe: dish?.recipe || null,
    restaurant_id: null,
    category_name: c?.name,
    category_emoji: c?.emoji,
  }
}

function savePick({ mode, dishId, restaurantId, source }) {
  const db = load()
  if (mode === 'out') {
    if (!db.restaurants.some((r) => r.id === restaurantId)) {
      return Promise.reject(new Error('请选择一家馆子'))
    }
  } else if (!db.dishes.some((d) => d.id === dishId)) {
    return Promise.reject(new Error('请选择一道菜'))
  }
  const date = todayDate()
  let pick = db.picks.find((p) => p.pick_date === date && p.mode === mode)
  if (pick) {
    pick.dish_id = mode === 'home' ? dishId : null
    pick.restaurant_id = mode === 'out' ? restaurantId : null
    pick.source = source
  } else {
    pick = {
      id: db.nextPickId++,
      dish_id: mode === 'home' ? dishId : null,
      restaurant_id: mode === 'out' ? restaurantId : null,
      pick_date: date,
      source,
      mode,
    }
    db.picks.push(pick)
  }
  save(db)
  return Promise.resolve(pickView(db, pick))
}

export const localApi = {
  login() {
    return Promise.reject(
      new Error('GitHub Pages 不能直连数据库。请用 npm run dev 启动后端，或给前端配置可访问的 API 地址。'),
    )
  },
  categories(kind = 'home') {
    const db = load()
    const wanted = kind === 'out' ? 'out' : 'home'
    return Promise.resolve(
      db.categories
        .filter((c) => (c.kind || 'home') === wanted)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((c) => ({
          ...c,
          dish_count:
            wanted === 'out'
              ? db.restaurants.filter((r) => r.category_id === c.id).length
              : db.dishes.filter((d) => d.category_id === c.id).length,
        })),
    )
  },
  addCategory({ name, emoji, kind }) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return Promise.reject(new Error('分类名称不能为空'))
    const wanted = kind === 'out' ? 'out' : 'home'
    const db = load()
    if (db.categories.some((c) => c.name === trimmed && (c.kind || 'home') === wanted)) {
      return Promise.reject(new Error('这个分类已经存在'))
    }
    const sameKind = db.categories.filter((c) => (c.kind || 'home') === wanted)
    const row = {
      id: db.nextCategoryId++,
      name: trimmed,
      emoji: String(emoji || '🍽️').trim() || '🍽️',
      sort_order: Math.max(0, ...sameKind.map((c) => c.sort_order), 0) + 1,
      kind: wanted,
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
    db.restaurants = (db.restaurants || []).filter((r) => r.category_id !== cid)
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
  addDish({ name, note, recipe, category_id }) {
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
      recipe: String(recipe || '').trim(),
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
  restaurants(categoryId) {
    const db = load()
    let list = db.restaurants || []
    if (categoryId) list = list.filter((r) => r.category_id === Number(categoryId))
    list = list.slice().sort((a, b) => Number(a.distance_km) - Number(b.distance_km) || b.id - a.id)
    return Promise.resolve(list.map((r) => withRestaurantCat(db, r)))
  },
  addRestaurant({ name, hits, note, category_id, distance_km, cost }) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return Promise.reject(new Error('馆子名称不能为空'))
    const cid = Number(category_id)
    if (!cid) return Promise.reject(new Error('请选择分类'))
    const distanceKm = Number(distance_km)
    const price = Number(cost)
    if (Number.isNaN(distanceKm) || distanceKm < 0) {
      return Promise.reject(new Error('请填写离家距离'))
    }
    if (!Number.isFinite(price) || price < 0) {
      return Promise.reject(new Error('请填写人均花费'))
    }
    const db = load()
    if (!db.restaurants) db.restaurants = []
    const row = {
      id: db.nextRestaurantId++,
      name: trimmed,
      hits: String(hits || '').trim(),
      note: String(note || '').trim(),
      category_id: cid,
      distance_km: distanceKm,
      cost: Math.round(price),
      created_at: new Date().toISOString(),
    }
    db.restaurants.push(row)
    save(db)
    return Promise.resolve(withRestaurantCat(db, row))
  },
  deleteRestaurant(id) {
    const db = load()
    db.restaurants = (db.restaurants || []).filter((r) => r.id !== Number(id))
    save(db)
    return Promise.resolve({ ok: true })
  },
  today(mode = 'home') {
    const db = load()
    const wanted = mode === 'out' ? 'out' : 'home'
    const pick = db.picks.find((p) => p.pick_date === todayDate() && (p.mode || 'home') === wanted)
    return Promise.resolve(pickView(db, pick))
  },
  pickToday(body) {
    const mode = body.mode === 'out' ? 'out' : 'home'
    return savePick({
      mode,
      dishId: body.dish_id ? Number(body.dish_id) : null,
      restaurantId: body.restaurant_id ? Number(body.restaurant_id) : null,
      source: 'manual',
    })
  },
  randomToday(body) {
    const db = load()
    const mode = body.mode === 'out' ? 'out' : 'home'
    if (mode === 'out') {
      let pool = db.restaurants || []
      if (body.category_id) pool = pool.filter((r) => r.category_id === Number(body.category_id))
      if (!pool.length) return Promise.reject(new Error('这个分类还没有馆子'))
      const restaurant = pool[Math.floor(Math.random() * pool.length)]
      return savePick({ mode, dishId: null, restaurantId: restaurant.id, source: 'random' })
    }
    let pool = db.dishes
    if (body.category_id) pool = pool.filter((d) => d.category_id === Number(body.category_id))
    if (!pool.length) return Promise.reject(new Error('这个分类还没有菜品'))
    const dish = pool[Math.floor(Math.random() * pool.length)]
    return savePick({ mode, dishId: dish.id, restaurantId: null, source: 'random' })
  },
}
