import express from 'express'
import cors from 'cors'
import { query } from './db.js'
import { seedCategories, seedDishes } from './seed.js'

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json())

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (pick_date)
    );
  `)

  const { rows } = await query('SELECT COUNT(*)::int AS count FROM categories')
  if (rows[0].count === 0) {
    for (const c of seedCategories) {
      await query(
        'INSERT INTO categories (name, emoji, sort_order) VALUES ($1, $2, $3)',
        [c.name, c.emoji, c.sort_order],
      )
    }
    const { rows: cats } = await query('SELECT id, name FROM categories')
    const idByName = Object.fromEntries(cats.map((c) => [c.name, c.id]))
    for (const d of seedDishes) {
      const categoryId = idByName[d.category]
      if (!categoryId) continue
      await query(
        'INSERT INTO dishes (name, category_id, note) VALUES ($1, $2, $3)',
        [d.name, categoryId, d.note],
      )
    }
    console.log(`Seeded ${seedCategories.length} categories and dishes`)
  }
}

function dishSelect() {
  return `
    SELECT
      d.id,
      d.name,
      d.note,
      d.created_at,
      c.id AS category_id,
      c.name AS category_name,
      c.emoji AS category_emoji
    FROM dishes d
    JOIN categories c ON c.id = d.category_id
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

app.get('/api/categories', async (_req, res) => {
  const { rows } = await query(`
    SELECT
      c.id,
      c.name,
      c.emoji,
      c.sort_order,
      COUNT(d.id)::int AS dish_count
    FROM categories c
    LEFT JOIN dishes d ON d.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order, c.id
  `)
  res.json(rows)
})

app.post('/api/categories', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const emoji = String(req.body.emoji || '🍽️').trim() || '🍽️'
  if (!name) return res.status(400).json({ error: '分类名称不能为空' })
  try {
    const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories')
    const { rows } = await query(
      'INSERT INTO categories (name, emoji, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name, emoji, maxRows[0].next],
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
  const params = []
  let where = ''
  if (categoryId) {
    params.push(categoryId)
    where = `WHERE d.category_id = $1`
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
  const categoryId = Number(req.body.category_id)
  if (!name) return res.status(400).json({ error: '菜品名称不能为空' })
  if (!categoryId) return res.status(400).json({ error: '请选择分类' })
  try {
    const inserted = await query(
      'INSERT INTO dishes (name, category_id, note) VALUES ($1, $2, $3) RETURNING id',
      [name, categoryId, note],
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

app.get('/api/today', async (_req, res) => {
  const { rows } = await query(`
    SELECT
      p.id,
      p.pick_date,
      p.source,
      d.id AS dish_id,
      d.name AS dish_name,
      d.note AS dish_note,
      c.name AS category_name,
      c.emoji AS category_emoji
    FROM daily_picks p
    LEFT JOIN dishes d ON d.id = p.dish_id
    LEFT JOIN categories c ON c.id = d.category_id
    WHERE p.pick_date = CURRENT_DATE
  `)
  res.json(rows[0] || null)
})

async function saveToday(dishId, source) {
  const { rows } = await query(
    `
    INSERT INTO daily_picks (dish_id, pick_date, source)
    VALUES ($1, CURRENT_DATE, $2)
    ON CONFLICT (pick_date)
    DO UPDATE SET dish_id = EXCLUDED.dish_id, source = EXCLUDED.source, created_at = NOW()
    RETURNING id
    `,
    [dishId, source],
  )
  const { rows: pickRows } = await query(
    `
    SELECT
      p.id,
      p.pick_date,
      p.source,
      d.id AS dish_id,
      d.name AS dish_name,
      d.note AS dish_note,
      c.name AS category_name,
      c.emoji AS category_emoji
    FROM daily_picks p
    JOIN dishes d ON d.id = p.dish_id
    JOIN categories c ON c.id = d.category_id
    WHERE p.id = $1
    `,
    [rows[0].id],
  )
  return pickRows[0]
}

app.post('/api/today', async (req, res) => {
  const dishId = Number(req.body.dish_id)
  if (!dishId) return res.status(400).json({ error: '请选择一道菜' })
  try {
    const pick = await saveToday(dishId, 'manual')
    res.json(pick)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/today/random', async (req, res) => {
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null
  const params = []
  let where = ''
  if (categoryId) {
    params.push(categoryId)
    where = 'WHERE category_id = $1'
  }
  const { rows } = await query(
    `SELECT id FROM dishes ${where} ORDER BY RANDOM() LIMIT 1`,
    params,
  )
  if (!rows[0]) return res.status(404).json({ error: '这个分类还没有菜品' })
  try {
    const pick = await saveToday(rows[0].id, 'random')
    res.json(pick)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Menu API listening on http://localhost:${port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to start server', err)
    process.exit(1)
  })
