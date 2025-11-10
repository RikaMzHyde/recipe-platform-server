import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import { query } from './db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { cloudinary } from './cloudinary'

const app = express()

// Configurar multer para manejar archivos en memoria
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (_req, file, cb) => {
    // Aceptar solo imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de imagen'))
    }
  },
})

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

// Upload Image to Cloudinary
app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' })
    }

    // Convertir el buffer a base64 para subirlo a Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64')
    const dataURI = `data:${req.file.mimetype};base64,${b64}`

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'recipe-platform',
      resource_type: 'image',
    })

    return res.json({
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (e) {
    console.error('Error al subir imagen:', e)
    return res.status(500).json({ error: 'Error al subir la imagen' })
  }
})

// Categories
app.get('/api/categories', async (_req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT id, name FROM public.categories ORDER BY name ASC')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Recipes
app.get('/api/recipes', async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.title, r.description, r.category_id AS "categoryId", c.name AS "categoryName",
              r.image_url AS "imageUrl", r.ingredients, r.prep_time AS "prepTime", 
              r.cook_time AS "cookTime", r.servings, r.difficulty, r.created_at AS "createdAt",
              r.user_id AS "userId", u.name AS "userName", u.avatar_url AS "userAvatar"
       FROM public.recipes r
       LEFT JOIN public.categories c ON c.id = r.category_id
       LEFT JOIN public.users u ON u.id = r.user_id
       ORDER BY r.created_at DESC`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

app.get('/api/recipes/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const { rows } = await query(
      `SELECT r.id, r.title, r.description, r.category_id AS "categoryId", c.name AS "categoryName",
              r.image_url AS "imageUrl", r.ingredients, r.prep_time AS "prepTime",
              r.cook_time AS "cookTime", r.servings, r.difficulty, r.created_at AS "createdAt",
              r.user_id AS "userId", u.name AS "userName", u.avatar_url AS "userAvatar"
       FROM public.recipes r
       LEFT JOIN public.categories c ON c.id = r.category_id
       LEFT JOIN public.users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [id]
    )
    const recipe = rows[0]
    if (!recipe) return res.status(404).json({ error: 'Not found' })
    res.json(recipe)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

const RecipeCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
  })).optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  servings: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["Fácil", "Media", "Difícil"]).optional(),
  userId: z.string().uuid(),
})

// Crear receta con imagen (multipart/form-data)
app.post('/api/recipes/with-image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    let imageUrl: string | null = null

    // Si se proporcionó una imagen, subirla a Cloudinary
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64')
      const dataURI = `data:${req.file.mimetype};base64,${b64}`
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'recipe-platform',
        resource_type: 'image',
      })
      imageUrl = result.secure_url
    }

    // Parsear los datos del formulario
    const formData = {
      ...req.body,
      imageUrl: imageUrl || req.body.imageUrl,
      servings: req.body.servings ? Number(req.body.servings) : undefined,
      categoryId: req.body.categoryId ? Number(req.body.categoryId) : undefined,
      ingredients: req.body.ingredients ? JSON.parse(req.body.ingredients) : undefined,
    }

    const parsed = RecipeCreateSchema.safeParse(formData)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }

    const {
      title,
      description,
      categoryId,
      imageUrl: finalImageUrl,
      ingredients,
      prepTime,
      cookTime,
      servings,
      difficulty,
      userId,
    } = parsed.data

    const { rows } = await query(
      `INSERT INTO public.recipes
        (user_id, category_id, title, description, ingredients, image_url, prep_time, cook_time, servings, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id AS "userId", category_id AS "categoryId", title, description, ingredients,
                 image_url AS "imageUrl", prep_time AS "prepTime", cook_time AS "cookTime", 
                 servings, difficulty, created_at AS "createdAt"`,
      [
        userId,
        categoryId ?? null,
        title,
        description ?? null,
        ingredients ? JSON.stringify(ingredients) : null,
        finalImageUrl ?? null,
        prepTime ?? null,
        cookTime ?? null,
        servings ?? null,
        difficulty ?? null,
      ]
    )
    return res.status(201).json(rows[0])
  } catch (e) {
    console.error('Error al crear receta:', e)
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Crear receta sin imagen (JSON)
app.post('/api/recipes', async (req: Request, res: Response) => {
  const parsed = RecipeCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }
  const {
    title,
    description,
    categoryId,
    imageUrl,
    ingredients,
    prepTime,
    cookTime,
    servings,
    difficulty,
    userId,
  } = parsed.data
  try {
    const { rows } = await query(
      `INSERT INTO public.recipes
        (user_id, category_id, title, description, ingredients, image_url, prep_time, cook_time, servings, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id AS "userId", category_id AS "categoryId", title, description, ingredients,
                 image_url AS "imageUrl", prep_time AS "prepTime", cook_time AS "cookTime",
                 servings, difficulty, created_at AS "createdAt"`,
      [
        userId,
        categoryId ?? null,
        title,
        description ?? null,
        ingredients ? JSON.stringify(ingredients) : null,
        imageUrl ?? null,
        prepTime ?? null,
        cookTime ?? null,
        servings ?? null,
        difficulty ?? null,
      ]
    )
    return res.status(201).json(rows[0])
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Actualizar receta
app.put('/api/recipes/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = RecipeCreateSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }
  const {
    title,
    description,
    categoryId,
    imageUrl,
    ingredients,
    prepTime,
    cookTime,
    servings,
    difficulty,
  } = parsed.data
  try {
    // Verificar que la receta existe
    const { rows: existing } = await query('SELECT id, user_id FROM public.recipes WHERE id = $1', [id])
    if (!existing[0]) return res.status(404).json({ error: 'Receta no encontrada' })

    // Construir la query de actualización solo con los campos proporcionados
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(title)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }
    if (categoryId !== undefined) {
      updates.push(`category_id = $${paramIndex++}`)
      values.push(categoryId)
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`)
      values.push(imageUrl)
    }
    if (ingredients !== undefined) {
      updates.push(`ingredients = $${paramIndex++}`)
      values.push(JSON.stringify(ingredients))
    }
    if (prepTime !== undefined) {
      updates.push(`prep_time = $${paramIndex++}`)
      values.push(prepTime)
    }
    if (cookTime !== undefined) {
      updates.push(`cook_time = $${paramIndex++}`)
      values.push(cookTime)
    }
    if (servings !== undefined) {
      updates.push(`servings = $${paramIndex++}`)
      values.push(servings)
    }
    if (difficulty !== undefined) {
      updates.push(`difficulty = $${paramIndex++}`)
      values.push(difficulty)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    values.push(id)
    const { rows } = await query(
      `UPDATE public.recipes SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING id, user_id AS "userId", category_id AS "categoryId", title, description, ingredients,
                 image_url AS "imageUrl", prep_time AS "prepTime", cook_time AS "cookTime", 
                 servings, difficulty, created_at AS "createdAt"`,
      values
    )
    return res.json(rows[0])
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
})

// Eliminar receta
app.delete('/api/recipes/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    // Verificar que la receta existe
    const { rows: existing } = await query('SELECT id FROM public.recipes WHERE id = $1', [id])
    if (!existing[0]) return res.status(404).json({ error: 'Receta no encontrada' })

    // Eliminar la receta (las relaciones en cascada eliminarán favoritos, ratings y comentarios)
    await query('DELETE FROM public.recipes WHERE id = $1', [id])
    return res.status(204).end()
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

// Actualizar usuario
app.put('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { name } = req.body
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' })
  }

  try {
    const { rows } = await query(
      'UPDATE public.users SET name = $1 WHERE id = $2 RETURNING id, name, email, avatar_url AS "avatarUrl", created_at AS "createdAt"',
      [name.trim(), id]
    )
    
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })
    
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Cambiar contraseña
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
})

app.put('/api/users/:id/password', async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = ChangePasswordSchema.safeParse(req.body)
  
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  }

  const { currentPassword, newPassword } = parsed.data

  try {
    // Obtener el usuario con su contraseña actual
    const { rows } = await query(
      'SELECT id, password_hash FROM public.users WHERE id = $1',
      [id]
    )
    
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })
    
    const user = rows[0] as { id: string; password_hash: string }
    
    // Verificar la contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' })
    }

    // Hashear la nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Actualizar la contraseña
    await query(
      'UPDATE public.users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, id]
    )

    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
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

// My Recipes (recetas del usuario)
app.get('/api/users/:userId/recipes', async (req: Request, res: Response) => {
  const { userId } = req.params
  try {
    const { rows } = await query(
      `SELECT r.id, r.title, r.description, r.category_id AS "categoryId", c.name AS "categoryName",
              r.image_url AS "imageUrl", r.ingredients, r.prep_time AS "prepTime",
              r.cook_time AS "cookTime", r.servings, r.difficulty, r.created_at AS "createdAt",
              r.user_id AS "userId"
       FROM public.recipes r
       LEFT JOIN public.categories c ON c.id = r.category_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
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
    if (!row) return res.status(404).json({ error: 'Este email no está registrado' })
    if (!row.password_hash) return res.status(401).json({ error: 'Cuenta sin contraseña' })
    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' })
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
  content: z.string().min(1),
  userId: z.string().uuid(),
})

// Listar comentarios de una receta (más recientes primero)
app.get('/api/recipes/:id/comments', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const { rows } = await query(
      `SELECT c.id,
              c.content,
              c.created_at AS "createdAt",
              c.user_id AS "userId",
              u.name AS "userName",
              u.avatar_url AS "userAvatar"
       FROM public.comments c
       INNER JOIN public.users u ON u.id = c.user_id
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

// Crear comentario
app.post('/api/recipes/:id/comments', async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = CommentCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
  const { content, userId } = parsed.data
  try {
    const { rows } = await query(
      `INSERT INTO public.comments (recipe_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at AS "createdAt", user_id AS "userId"`,
      [id, userId, content]
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
