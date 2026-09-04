import express from 'express'
import cors from 'cors'
import { query } from './db.js'
import {
  seedCategories,
  seedDishes,
  seedRestaurantCategories,
  seedRestaurants,
} from './seed.js'
import {
  hashPassword,
  passwordMatches,
  readBearerToken,
  signToken,
  verifyToken,
} from './auth.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const corsOrigins = String(
  process.env.CORS_ORIGIN || 'https://rstormrage.github.io,http://localhost:5173',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.set('trust proxy', 1)
app.use(
  cors({
    origin: corsOrigins,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)
app.use(express.json())

function normalizeKind(value) {
  return value === 'out' ? 'out' : 'home'
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      emoji VARCHAR(16) DEFAULT '🍽️',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dishes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_picks (
      id SERIAL PRIMARY KEY,
      dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
      pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
      source VARCHAR(20) NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  await query(`
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'home';
    ALTER TABLE dishes ADD COLUMN IF NOT EXISTS recipe TEXT DEFAULT '';
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      hits TEXT DEFAULT '',
      distance_km NUMERIC(6,2) DEFAULT 0,
      cost INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  await query(`
    ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'home';
    ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL;
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
    ALTER TABLE daily_picks DROP CONSTRAINT IF EXISTS daily_picks_pick_date_key;
    CREATE UNIQUE INDEX IF NOT EXISTS categories_kind_name_idx ON categories (kind, name);
    CREATE UNIQUE INDEX IF NOT EXISTS daily_picks_date_mode_idx ON daily_picks (pick_date, mode);
  `)

  const { rows: authRows } = await query('SELECT COUNT(*)::int AS count FROM app_auth')
  if (authRows[0].count === 0) {
    const hash = await hashPassword(process.env.SITE_PASSWORD || '134679')
    await query('INSERT INTO app_auth (id, password_hash) VALUES (1, $1)', [hash])
    console.log('Stored site password hash in database')
  }

  const { rows } = await query('SELECT COUNT(*)::int AS count FROM categories WHERE kind = $1', ['home'])
  if (rows[0].count === 0) {
    for (const c of seedCategories) {
      await query(
        'INSERT INTO categories (name, emoji, sort_order, kind) VALUES ($1, $2, $3, $4)',
        [c.name, c.emoji, c.sort_order, 'home'],
      )
    }
    const { rows: cats } = await query('SELECT id, name FROM categories WHERE kind = $1', ['home'])
    const idByName = Object.fromEntries(cats.map((c) => [c.name, c.id]))
    for (const d of seedDishes) {
      const categoryId = idByName[d.category]
      if (!categoryId) continue
      await query(
        'INSERT INTO dishes (name, category_id, note, recipe) VALUES ($1, $2, $3, $4)',
        [d.name, categoryId, d.note, d.recipe || ''],
      )
    }
    console.log(`Seeded ${seedCategories.length} home categories and dishes`)
  }

  for (const d of seedDishes) {
    if (!d.recipe) continue
    await query(
      `UPDATE dishes SET recipe = $1 WHERE name = $2 AND (recipe IS NULL OR recipe = '')`,
      [d.recipe, d.name],
    )
  }

  const { rows: outCats } = await query('SELECT COUNT(*)::int AS count FROM categories WHERE kind = $1', [
    'out',
  ])
  if (outCats[0].count === 0) {
    for (const c of seedRestaurantCategories) {
      await query(
        'INSERT INTO categories (name, emoji, sort_order, kind) VALUES ($1, $2, $3, $4)',
        [c.name, c.emoji, c.sort_order, 'out'],
      )
    }
    const { rows: cats } = await query('SELECT id, name FROM categories WHERE kind = $1', ['out'])
    const idByName = Object.fromEntries(cats.map((c) => [c.name, c.id]))
    for (const r of seedRestaurants) {
      const categoryId = idByName[r.category]
      if (!categoryId) continue
      await query(
        `INSERT INTO restaurants (name, category_id, hits, distance_km, cost, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.name, categoryId, r.hits, r.distance_km, r.cost, r.note],
      )
    }
    console.log(`Seeded ${seedRestaurantCategories.length} restaurant categories`)
  }
}

function dishSelect() {
  return `
    SELECT
      d.id,
      d.name,
      d.note,
      d.recipe,
      d.created_at,
      c.id AS category_id,
      c.name AS category_name,
      c.emoji AS category_emoji
    FROM dishes d
    JOIN categories c ON c.id = d.category_id
  `
}

function restaurantSelect() {
  return `
    SELECT
      r.id,
      r.name,
      r.hits,
      r.distance_km,
      r.cost,
      r.note,
      r.created_at,
      c.id AS category_id,
      c.name AS category_name,
      c.emoji AS category_emoji
    FROM restaurants r
    JOIN categories c ON c.id = r.category_id
  `
}

function todaySelect() {
  return `
    SELECT
      p.id,
      p.pick_date,
      p.source,
      p.mode,
      d.id AS dish_id,
      d.name AS dish_name,
      d.note AS dish_note,
      d.recipe AS dish_recipe,
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.hits AS restaurant_hits,
      r.distance_km,
      r.cost,
      r.note AS restaurant_note,
      COALESCE(hc.name, oc.name) AS category_name,
      COALESCE(hc.emoji, oc.emoji) AS category_emoji
    FROM daily_picks p
    LEFT JOIN dishes d ON d.id = p.dish_id
    LEFT JOIN categories hc ON hc.id = d.category_id
    LEFT JOIN restaurants r ON r.id = p.restaurant_id
    LEFT JOIN categories oc ON oc.id = r.category_id
  `
}

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const password = String(req.body?.password || '')
    const { rows } = await query('SELECT password_hash FROM app_auth WHERE id = 1')
    if (!rows[0] || !(await passwordMatches(password, rows[0].password_hash))) {
      return res.status(401).json({ error: '密码不对' })
    }
    res.json({ token: signToken() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function requireAuth(req, res, next) {
  if (!verifyToken(readBearerToken(req))) {
    return res.status(401).json({ error: '请先登录' })
  }
  next()
}

app.use('/api', requireAuth)

app.get('/api/categories', async (req, res) => {
  const kind = normalizeKind(req.query.kind)
  const { rows } = await query(
    `
    SELECT
      c.id,
      c.name,
      c.emoji,
      c.sort_order,
      c.kind,
      CASE
        WHEN c.kind = 'out' THEN COUNT(r.id)::int
        ELSE COUNT(d.id)::int
      END AS dish_count
    FROM categories c
    LEFT JOIN dishes d ON d.category_id = c.id AND c.kind = 'home'
    LEFT JOIN restaurants r ON r.category_id = c.id AND c.kind = 'out'
    WHERE c.kind = $1
    GROUP BY c.id
    ORDER BY c.sort_order, c.id
    `,
    [kind],
  )
  res.json(rows)
})

app.post('/api/categories', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const emoji = String(req.body.emoji || '🍽️').trim() || '🍽️'
  const kind = normalizeKind(req.body.kind)
  if (!name) return res.status(400).json({ error: '分类名称不能为空' })
  try {
    const { rows: maxRows } = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories WHERE kind = $1',
      [kind],
    )
    const { rows } = await query(
      'INSERT INTO categories (name, emoji, sort_order, kind) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, emoji, maxRows[0].next, kind],
    )
    res.status(201).json({ ...rows[0], dish_count: 0 })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '这个分类已经存在' })
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/categories/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: '分类不存在' })
  res.json({ ok: true })
})

app.get('/api/dishes', async (req, res) => {
  const categoryId = req.query.categoryId
  const params = ['home']
  let where = `WHERE c.kind = $1`
  if (categoryId) {
    params.push(categoryId)
    where += ` AND d.category_id = $2`
  }
  const { rows } = await query(
    `${dishSelect()} ${where} ORDER BY d.created_at DESC, d.id DESC`,
    params,
  )
  res.json(rows)
})

app.post('/api/dishes', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const note = String(req.body.note || '').trim()
  const recipe = String(req.body.recipe || '').trim()
  const categoryId = Number(req.body.category_id)
  if (!name) return res.status(400).json({ error: '菜品名称不能为空' })
  if (!categoryId) return res.status(400).json({ error: '请选择分类' })
  try {
    const inserted = await query(
      'INSERT INTO dishes (name, category_id, note, recipe) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, categoryId, note, recipe],
    )
    const { rows: dishRows } = await query(`${dishSelect()} WHERE d.id = $1`, [inserted.rows[0].id])
    res.status(201).json(dishRows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/dishes/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM dishes WHERE id = $1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: '菜品不存在' })
  res.json({ ok: true })
})

app.get('/api/restaurants', async (req, res) => {
  const categoryId = req.query.categoryId
  const params = ['out']
  let where = `WHERE c.kind = $1`
  if (categoryId) {
    params.push(categoryId)
    where += ` AND r.category_id = $2`
  }
  const { rows } = await query(
    `${restaurantSelect()} ${where} ORDER BY r.distance_km ASC, r.id DESC`,
    params,
  )
  res.json(rows)
})

app.post('/api/restaurants', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const hits = String(req.body.hits || '').trim()
  const note = String(req.body.note || '').trim()
  const categoryId = Number(req.body.category_id)
  const distanceKm = Number(req.body.distance_km)
  const cost = Number(req.body.cost)
  if (!name) return res.status(400).json({ error: '馆子名称不能为空' })
  if (!categoryId) return res.status(400).json({ error: '请选择分类' })
  if (Number.isNaN(distanceKm) || distanceKm < 0) {
    return res.status(400).json({ error: '请填写离家距离' })
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return res.status(400).json({ error: '请填写人均花费' })
  }
  try {
    const inserted = await query(
      `INSERT INTO restaurants (name, category_id, hits, distance_km, cost, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, categoryId, hits, distanceKm, Math.round(cost), note],
    )
    const { rows } = await query(`${restaurantSelect()} WHERE r.id = $1`, [inserted.rows[0].id])
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/restaurants/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM restaurants WHERE id = $1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: '馆子不存在' })
  res.json({ ok: true })
})

app.get('/api/today', async (req, res) => {
  const mode = normalizeKind(req.query.mode)
  const { rows } = await query(`${todaySelect()} WHERE p.pick_date = CURRENT_DATE AND p.mode = $1`, [
    mode,
  ])
  res.json(rows[0] || null)
})

async function loadPick(id) {
  const { rows } = await query(`${todaySelect()} WHERE p.id = $1`, [id])
  return rows[0] || null
}

async function saveToday({ mode, dishId, restaurantId, source }) {
  const { rows } = await query(
    `
    INSERT INTO daily_picks (dish_id, restaurant_id, pick_date, source, mode)
    VALUES ($1, $2, CURRENT_DATE, $3, $4)
    ON CONFLICT (pick_date, mode)
    DO UPDATE SET
      dish_id = EXCLUDED.dish_id,
      restaurant_id = EXCLUDED.restaurant_id,
      source = EXCLUDED.source,
      created_at = NOW()
    RETURNING id
    `,
    [dishId, restaurantId, source, mode],
  )
  return loadPick(rows[0].id)
}

app.post('/api/today', async (req, res) => {
  const mode = normalizeKind(req.body.mode)
  const dishId = req.body.dish_id ? Number(req.body.dish_id) : null
  const restaurantId = req.body.restaurant_id ? Number(req.body.restaurant_id) : null
  if (mode === 'out') {
    if (!restaurantId) return res.status(400).json({ error: '请选择一家馆子' })
  } else if (!dishId) {
    return res.status(400).json({ error: '请选择一道菜' })
  }
  try {
    const pick = await saveToday({
      mode,
      dishId: mode === 'home' ? dishId : null,
      restaurantId: mode === 'out' ? restaurantId : null,
      source: 'manual',
    })
    res.json(pick)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/today/random', async (req, res) => {
  const mode = normalizeKind(req.body.mode)
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null
  try {
    if (mode === 'out') {
      const params = ['out']
      let where = 'WHERE c.kind = $1'
      if (categoryId) {
        params.push(categoryId)
        where += ' AND r.category_id = $2'
      }
      const { rows } = await query(
        `SELECT r.id FROM restaurants r JOIN categories c ON c.id = r.category_id ${where} ORDER BY RANDOM() LIMIT 1`,
        params,
      )
      if (!rows[0]) return res.status(404).json({ error: '这个分类还没有馆子' })
      const pick = await saveToday({
        mode,
        dishId: null,
        restaurantId: rows[0].id,
        source: 'random',
      })
      return res.json(pick)
    }

    const params = ['home']
    let where = 'WHERE c.kind = $1'
    if (categoryId) {
      params.push(categoryId)
      where += ' AND d.category_id = $2'
    }
    const { rows } = await query(
      `SELECT d.id FROM dishes d JOIN categories c ON c.id = d.category_id ${where} ORDER BY RANDOM() LIMIT 1`,
      params,
    )
    if (!rows[0]) return res.status(404).json({ error: '这个分类还没有菜品' })
    const pick = await saveToday({
      mode,
      dishId: rows[0].id,
      restaurantId: null,
      source: 'random',
    })
    res.json(pick)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

initDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Menu API listening on port ${port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to start server', err)
    process.exit(1)
  })
