import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { query } from './db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const app = express()

app.use(cors())
app.use(express.json())

// Health
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message })
  }
})

// Recipes
app.get('/api/recipes', async (_req: Request, res: Response) => {
  const { rows } = await query(
    'SELECT id, title, description, category, image_url AS "imageUrl", author, author_avatar AS "authorAvatar", prep_time AS "prepTime", cook_time AS "cookTime", servings, difficulty, created_at AS "createdAt", user_id AS "userId" FROM public.recipes ORDER BY title ASC'
  )
  res.json(rows)
})

app.get('/api/recipes/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { rows } = await query(
    'SELECT id, title, description, category, image_url AS "imageUrl", author, author_avatar AS "authorAvatar", prep_time AS "prepTime", cook_time AS "cookTime", servings, difficulty, created_at AS "createdAt", user_id AS "userId" FROM public.recipes WHERE id = $1',
    [id]
  )
  const recipe = rows[0]
  if (!recipe) return res.status(404).json({ error: 'Not found' })
  res.json(recipe)
})

const RecipeCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  author: z.string().optional(),
  authorAvatar: z.string().url().optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  servings: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["facil", "media", "dificil"]).optional(),
  userId: z.string().uuid().optional(),
})

app.post('/api/recipes', async (req: Request, res: Response) => {
  const parsed = RecipeCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }
  const {
    title,
    description,
    category,
    imageUrl,
    author,
    authorAvatar,
    prepTime,
    cookTime,
    servings,
    difficulty,
    userId,
  } = parsed.data
  try {
    const { rows } = await query(
      `INSERT INTO public.recipes
        (title, description, category, image_url, author, author_avatar, prep_time, cook_time, servings, difficulty, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, description, category, image_url AS "imageUrl", author, author_avatar AS "authorAvatar", prep_time AS "prepTime", cook_time AS "cookTime", servings, difficulty, created_at AS "createdAt", user_id AS "userId"`,
      [
        title,
        description ?? null,
        category ?? null,
        imageUrl ?? null,
        author ?? null,
        authorAvatar ?? null,
        prepTime ?? null,
        cookTime ?? null,
        servings ?? null,
        difficulty ?? null,
        userId ?? null,
      ]
    )
    return res.status(201).json(rows[0])
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Users
app.get('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { rows } = await query(
    'SELECT id, name, email, avatar_url AS "avatarUrl", created_at AS "createdAt" FROM public.users WHERE id = $1',
    [id]
  )
  const user = rows[0]
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
})

// Favorites
app.get('/api/users/:userId/favorites', async (req: Request, res: Response) => {
  const { userId } = req.params
  const { rows } = await query(
    'SELECT user_id AS "userId", recipe_id AS "recipeId", created_at AS "createdAt" FROM public.favorites WHERE user_id = $1',
    [userId]
  )
  res.json(rows)
})

app.post('/api/users/:userId/favorites', async (req: Request, res: Response) => {
  const { userId } = req.params
  const { recipeId } = req.body as { recipeId: string }
  try {
    const { rows } = await query(
      'INSERT INTO public.favorites (user_id, recipe_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id AS "userId", recipe_id AS "recipeId", created_at AS "createdAt"',
      [userId, recipeId]
    )
    res.status(201).json(rows[0] ?? { userId, recipeId })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.delete('/api/users/:userId/favorites/:recipeId', async (req: Request, res: Response) => {
  const { userId, recipeId } = req.params
  try {
    await query('DELETE FROM public.favorites WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId])
    res.status(204).end()
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// My Recipes (collection)
app.get('/api/users/:userId/my-recipes', async (req: Request, res: Response) => {
  const { userId } = req.params
  const { rows } = await query(
    'SELECT user_id AS "userId", recipe_id AS "recipeId", created_at AS "createdAt" FROM public.my_recipes WHERE user_id = $1',
    [userId]
  )
  res.json(rows)
})

app.post('/api/users/:userId/my-recipes', async (req: Request, res: Response) => {
  const { userId } = req.params
  const { recipeId } = req.body as { recipeId: string }
  try {
    const { rows } = await query(
      'INSERT INTO public.my_recipes (user_id, recipe_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id AS "userId", recipe_id AS "recipeId", created_at AS "createdAt"',
      [userId, recipeId]
    )
    res.status(201).json(rows[0] ?? { userId, recipeId })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.delete('/api/users/:userId/my-recipes/:recipeId', async (req: Request, res: Response) => {
  const { userId, recipeId } = req.params
  try {
    await query('DELETE FROM public.my_recipes WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId])
    res.status(204).end()
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// Auth: Register
const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  avatarUrl: z.string().url().optional(),
})

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }
  const { name, email, password, avatarUrl } = parsed.data
  try {
    // ¿Existe ya el email?
    const { rows: exists } = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM public.users WHERE lower(email) = lower($1)) AS exists',
      [email]
    )
    if (exists[0]?.exists) {
      return res.status(409).json({ error: 'El email ya está registrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { rows } = await query(
      'INSERT INTO public.users (name, email, avatar_url, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar_url AS "avatarUrl", created_at AS "createdAt"',
      [name, email, avatarUrl ?? null, passwordHash]
    )
    const user = rows[0]
    return res.status(201).json(user)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Auth: Login
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }
  const { email, password } = parsed.data
  try {
    const { rows } = await query(
      'SELECT id, name, email, avatar_url AS "avatarUrl", created_at AS "createdAt", password_hash FROM public.users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    )
    const row = rows[0] as any
    if (!row) return res.status(401).json({ error: 'Credenciales inválidas' })
    if (!row.password_hash) return res.status(401).json({ error: 'Cuenta sin contraseña' })
    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })
    const { password_hash: _ph, ...user } = row
    return res.json(user)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Ratings
const RatingSchema = z.object({ rating: z.coerce.number().int().min(1).max(5) })

// Promedio y conteo de una receta
app.get('/api/recipes/:id/ratings', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const { rows } = await query<{ avg: number | null; count: string }>(
      'SELECT AVG(rating)::numeric(10,2) as avg, COUNT(*)::text as count FROM public.ratings WHERE recipe_id = $1',
      [id]
    )
    const avg = rows[0]?.avg
    const count = Number(rows[0]?.count ?? 0)
    return res.json({ average: avg !== null ? Number(avg) : 0, count })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Rating del usuario para una receta
app.get('/api/users/:userId/ratings/:recipeId', async (req: Request, res: Response) => {
  const { userId, recipeId } = req.params
  try {
    const { rows } = await query<{ rating: number }>(
      'SELECT rating FROM public.ratings WHERE user_id = $1 AND recipe_id = $2',
      [userId, recipeId]
    )
    if (!rows[0]) return res.json({ rating: null })
    return res.json({ rating: rows[0].rating })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Crear/actualizar rating
app.put('/api/users/:userId/ratings/:recipeId', async (req: Request, res: Response) => {
  const { userId, recipeId } = req.params
  const parsed = RatingSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
  const { rating } = parsed.data
  try {
    const { rows } = await query(
      `INSERT INTO public.ratings (user_id, recipe_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, recipe_id) DO UPDATE SET rating = EXCLUDED.rating
       RETURNING user_id AS "userId", recipe_id AS "recipeId", rating`,
      [userId, recipeId, rating]
    )
    return res.json(rows[0])
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Eliminar rating del usuario
app.delete('/api/users/:userId/ratings/:recipeId', async (req: Request, res: Response) => {
  const { userId, recipeId } = req.params
  try {
    await query('DELETE FROM public.ratings WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId])
    return res.status(204).end()
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Comments
const CommentCreateSchema = z.object({
  text: z.string().min(1),
  userId: z.string().uuid().optional(),
})

// Listar comentarios de una receta (más recientes primero)
app.get('/api/recipes/:id/comments', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const { rows } = await query(
      `SELECT c.id,
              c.text,
              c.created_at AS "createdAt",
              c.user_id AS "userId",
              COALESCE(c.author_name, u.name, 'Anónimo') AS "authorName",
              COALESCE(c.author_avatar_url, u.avatar_url, NULL) AS "authorAvatar"
       FROM public.comments c
       LEFT JOIN public.users u ON u.id = c.user_id
       WHERE c.recipe_id = $1
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [id]
    )
    return res.json(rows)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Crear comentario (anónimo o con usuario)
app.post('/api/recipes/:id/comments', async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = CommentCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
  const { text, userId } = parsed.data
  try {
    const { rows } = await query(
      `INSERT INTO public.comments (id, recipe_id, user_id, author_name, author_avatar_url, text)
       VALUES (gen_random_uuid(), $1, $2, CASE WHEN $2 IS NULL THEN 'Anónimo' ELSE NULL END, NULL, $3)
       RETURNING id, text, created_at AS "createdAt", user_id AS "userId", author_name AS "authorName", author_avatar_url AS "authorAvatar"`,
      [id, userId ?? null, text]
    )
    return res.status(201).json(rows[0])
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

const PORT = process.env.PORT || 5174
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
