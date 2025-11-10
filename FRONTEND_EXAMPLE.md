# Ejemplos de uso desde el Frontend

## Componente React para subir recetas con imagen

```tsx
'use client'

import { useState, useEffect } from 'react'

interface Category {
  id: number
  name: string
}

interface Ingredient {
  name: string
  amount: string
}

export function CreateRecipeForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '' }])

  // Cargar categorías al montar el componente
  useEffect(() => {
    fetch('http://localhost:5174/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Error al cargar categorías:', err))
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      // Crear preview local
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '' }])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, field: 'name' | 'amount', value: string) => {
    const newIngredients = [...ingredients]
    newIngredients[index][field] = value
    setIngredients(newIngredients)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      
      // Agregar userId (requerido)
      formData.append('userId', userId)
      
      // Si hay imagen, agregarla al FormData
      if (imageFile) {
        formData.append('image', imageFile)
      }

      // Agregar ingredientes como JSON
      const validIngredients = ingredients.filter(ing => ing.name && ing.amount)
      if (validIngredients.length > 0) {
        formData.append('ingredients', JSON.stringify(validIngredients))
      }

      const response = await fetch('http://localhost:5174/api/recipes/with-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear la receta')
      }

      const recipe = await response.json()
      console.log('Receta creada:', recipe)
      
      // Redirigir o mostrar mensaje de éxito
      alert('¡Receta creada con éxito!')
      
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Error al crear la receta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Título *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoryId"
          name="categoryId"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="">Seleccionar categoría...</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Ingredientes
        </label>
        {ingredients.map((ingredient, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Nombre"
              value={ingredient.name}
              onChange={(e) => updateIngredient(index, 'name', e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm"
            />
            <input
              type="text"
              placeholder="Cantidad"
              value={ingredient.amount}
              onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
              className="w-32 rounded-md border-gray-300 shadow-sm"
            />
            {ingredients.length > 1 && (
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="px-3 py-1 bg-red-500 text-white rounded-md"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addIngredient}
          className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md"
        >
          + Agregar ingrediente
        </button>
      </div>

      <div>
        <label htmlFor="image" className="block text-sm font-medium">
          Imagen
        </label>
        <input
          type="file"
          id="image"
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1 block w-full"
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="mt-2 h-48 w-full object-cover rounded-md"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="prepTime" className="block text-sm font-medium">
            Tiempo de preparación
          </label>
          <input
            type="text"
            id="prepTime"
            name="prepTime"
            placeholder="ej: 30 min"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="cookTime" className="block text-sm font-medium">
            Tiempo de cocción
          </label>
          <input
            type="text"
            id="cookTime"
            name="cookTime"
            placeholder="ej: 45 min"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="servings" className="block text-sm font-medium">
            Porciones
          </label>
          <input
            type="number"
            id="servings"
            name="servings"
            min="1"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium">
            Dificultad
          </label>
          <select
            id="difficulty"
            name="difficulty"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="Fácil">Fácil</option>
            <option value="Media">Media</option>
            <option value="Difícil">Difícil</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Receta'}
      </button>
    </form>
  )
}
```

## Opción alternativa: Subir imagen primero

Si prefieres subir la imagen primero y luego crear la receta:

```tsx
const handleSubmitWithSeparateUpload = async (
  userId: string,
  title: string,
  description: string,
  categoryId: number | null,
  ingredients: Ingredient[],
  prepTime: string,
  cookTime: string,
  servings: number | null,
  difficulty: string,
  imageFile: File | null
) => {
  try {
    let imageUrl = ''

    // 1. Subir la imagen si existe
    if (imageFile) {
      const imageFormData = new FormData()
      imageFormData.append('image', imageFile)

      const uploadResponse = await fetch('http://localhost:5174/api/upload', {
        method: 'POST',
        body: imageFormData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Error al subir la imagen')
      }

      const { url } = await uploadResponse.json()
      imageUrl = url
    }

    // 2. Crear la receta con JSON
    const recipeData = {
      userId,
      title,
      description,
      categoryId,
      ingredients,
      imageUrl: imageUrl || undefined,
      prepTime,
      cookTime,
      servings,
      difficulty,
    }

    const response = await fetch('http://localhost:5174/api/recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipeData),
    })

    if (!response.ok) {
      throw new Error('Error al crear la receta')
    }

    const recipe = await response.json()
    console.log('Receta creada:', recipe)
    alert('¡Receta creada con éxito!')
    return recipe

  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}
```

## Visualizar recetas con imágenes

```tsx
interface Recipe {
  id: string
  title: string
  description: string
  categoryId: number | null
  categoryName: string | null
  imageUrl: string | null
  ingredients: Array<{ name: string; amount: string }> | null
  prepTime: string | null
  cookTime: string | null
  servings: number | null
  difficulty: string | null
  createdAt: string
  userId: string
  userName: string
  userAvatar: string | null
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-lg">
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {recipe.userAvatar && (
            <img
              src={recipe.userAvatar}
              alt={recipe.userName}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600">{recipe.userName}</span>
        </div>

        <h3 className="text-xl font-bold">{recipe.title}</h3>
        
        {recipe.categoryName && (
          <span className="inline-block mt-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
            {recipe.categoryName}
          </span>
        )}

        <p className="text-gray-600 mt-2">{recipe.description}</p>

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="mt-3">
            <h4 className="font-semibold text-sm mb-1">Ingredientes:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                <li key={idx}>• {ing.name}: {ing.amount}</li>
              ))}
              {recipe.ingredients.length > 3 && (
                <li className="text-gray-400">... y {recipe.ingredients.length - 3} más</li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          {recipe.prepTime && <span>⏱️ Prep: {recipe.prepTime}</span>}
          {recipe.cookTime && <span>🍳 Cook: {recipe.cookTime}</span>}
          {recipe.servings && <span>👥 {recipe.servings} porciones</span>}
        </div>

        {recipe.difficulty && (
          <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {recipe.difficulty}
          </span>
        )}
      </div>
    </div>
  )
}
```

## Listar recetas

```tsx
export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:5174/api/recipes')
      .then(res => res.json())
      .then(data => {
        setRecipes(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error al cargar recetas:', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Cargando recetas...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  )
}
```

## Notas importantes

1. **userId requerido**: Todas las recetas deben tener un `userId` válido (UUID del usuario autenticado)
2. **Categorías**: Las categorías se gestionan por ID. Usa el endpoint `/api/categories` para obtener la lista
3. **Ingredientes**: Se almacenan como JSONB en formato `[{"name": "...", "amount": "..."}]`
4. **Dificultad**: Los valores válidos son "Fácil", "Media" o "Difícil" (con mayúscula inicial)
5. **CORS**: El backend ya tiene CORS habilitado
6. **Tamaño de archivos**: El límite actual es 5MB por imagen
7. **Formatos**: Se aceptan todos los formatos de imagen comunes (jpg, png, gif, webp, etc.)
8. **Preview local**: El ejemplo muestra cómo crear un preview de la imagen antes de subirla
9. **Manejo de errores**: Siempre maneja los errores apropiadamente en producción

## Endpoints disponibles

### Recetas
- `GET /api/recipes` - Listar todas las recetas
- `GET /api/recipes/:id` - Obtener una receta específica
- `POST /api/recipes` - Crear receta (JSON)
- `POST /api/recipes/with-image` - Crear receta con imagen (multipart)
- `GET /api/users/:userId/recipes` - Obtener recetas de un usuario

### Categorías
- `GET /api/categories` - Listar todas las categorías

### Imágenes
- `POST /api/upload` - Subir imagen a Cloudinary

### Comentarios
- `GET /api/recipes/:id/comments` - Listar comentarios de una receta
- `POST /api/recipes/:id/comments` - Crear comentario (requiere `userId` y `content`)

### Favoritos
- `GET /api/users/:userId/favorites` - Listar favoritos del usuario
- `POST /api/users/:userId/favorites` - Agregar a favoritos (body: `{recipeId}`)
- `DELETE /api/users/:userId/favorites/:recipeId` - Eliminar de favoritos

### Ratings
- `GET /api/recipes/:id/ratings` - Obtener promedio y conteo de ratings
- `GET /api/users/:userId/ratings/:recipeId` - Obtener rating del usuario para una receta
- `PUT /api/users/:userId/ratings/:recipeId` - Crear/actualizar rating (body: `{rating: 1-5}`)
- `DELETE /api/users/:userId/ratings/:recipeId` - Eliminar rating
