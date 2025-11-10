# Recipe Platform - Backend API

## Configuración de Cloudinary

Para habilitar la subida de imágenes, debes configurar la variable de entorno `CLOUDINARY_URL` en tu archivo `.env`:

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Puedes obtener esta URL desde tu dashboard de Cloudinary.

## Endpoints de Imágenes

### 1. Subir imagen independiente

**POST** `/api/upload`

Sube una imagen a Cloudinary y devuelve la URL.

**Content-Type:** `multipart/form-data`

**Body:**
- `image` (file): Archivo de imagen (máx. 5MB)

**Respuesta exitosa:**
```json
{
  "url": "https://res.cloudinary.com/...",
  "publicId": "recipe-platform/..."
}
```

**Ejemplo con fetch:**
```javascript
const formData = new FormData()
formData.append('image', fileInput.files[0])

const response = await fetch('http://localhost:5174/api/upload', {
  method: 'POST',
  body: formData
})

const { url } = await response.json()
```

## Endpoints de Categorías

### Listar categorías

**GET** `/api/categories`

Devuelve todas las categorías disponibles.

**Respuesta:**
```json
[
  { "id": 1, "name": "Arroces" },
  { "id": 2, "name": "Postres" }
]
```

## Endpoints de Recetas

### 1. Crear receta con imagen

**POST** `/api/recipes/with-image`

Crea una receta y sube la imagen en una sola petición.

**Content-Type:** `multipart/form-data`

**Body:**
- `image` (file, opcional): Archivo de imagen
- `title` (string, requerido): Título de la receta
- `userId` (string UUID, requerido): ID del usuario que crea la receta
- `description` (string, opcional): Descripción
- `categoryId` (number, opcional): ID de la categoría
- `ingredients` (string JSON, opcional): Array de ingredientes `[{"name":"Harina","amount":"200g"}]`
- `prepTime` (string, opcional): Tiempo de preparación
- `cookTime` (string, opcional): Tiempo de cocción
- `servings` (number, opcional): Número de porciones
- `difficulty` (string, opcional): "Fácil", "Media" o "Difícil"

**Ejemplo con fetch:**
```javascript
const formData = new FormData()
formData.append('image', fileInput.files[0])
formData.append('title', 'Paella Valenciana')
formData.append('userId', 'uuid-del-usuario')
formData.append('description', 'Receta tradicional de paella')
formData.append('categoryId', '1')
formData.append('ingredients', JSON.stringify([
  { name: 'Arroz', amount: '400g' },
  { name: 'Pollo', amount: '500g' }
]))
formData.append('prepTime', '30 min')
formData.append('cookTime', '45 min')
formData.append('servings', '4')
formData.append('difficulty', 'Media')

const response = await fetch('http://localhost:5174/api/recipes/with-image', {
  method: 'POST',
  body: formData
})

const recipe = await response.json()
```

### 2. Crear receta sin imagen (JSON)

**POST** `/api/recipes`

Crea una receta usando JSON (sin archivo de imagen).

**Content-Type:** `application/json`

**Body:**
```json
{
  "title": "Paella Valenciana",
  "userId": "uuid-del-usuario",
  "description": "Receta tradicional",
  "categoryId": 1,
  "ingredients": [
    { "name": "Arroz", "amount": "400g" },
    { "name": "Pollo", "amount": "500g" }
  ],
  "imageUrl": "https://...",
  "prepTime": "30 min",
  "cookTime": "45 min",
  "servings": 4,
  "difficulty": "Media"
}
```

### 3. Listar recetas

**GET** `/api/recipes`

Devuelve todas las recetas con información del usuario y categoría.

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "title": "Paella Valenciana",
    "description": "...",
    "categoryId": 1,
    "categoryName": "Arroces",
    "imageUrl": "https://...",
    "ingredients": [{"name": "Arroz", "amount": "400g"}],
    "prepTime": "30 min",
    "cookTime": "45 min",
    "servings": 4,
    "difficulty": "Media",
    "createdAt": "2024-01-01T00:00:00Z",
    "userId": "uuid",
    "userName": "Juan Pérez",
    "userAvatar": "https://..."
  }
]
```

### 4. Obtener receta por ID

**GET** `/api/recipes/:id`

Devuelve una receta específica con toda su información.

## Flujo recomendado desde el frontend

### Opción 1: Subida en dos pasos
1. Subir la imagen usando `/api/upload`
2. Crear la receta con la URL obtenida usando `/api/recipes`

### Opción 2: Subida en un solo paso
1. Usar `/api/recipes/with-image` enviando la imagen y los datos juntos

## Límites y restricciones

- Tamaño máximo de imagen: 5MB
- Formatos aceptados: Todos los formatos de imagen (jpg, png, gif, webp, etc.)
- Las imágenes se almacenan en la carpeta `recipe-platform` de Cloudinary
