import { v2 as cloudinary } from 'cloudinary'

// Configurar Cloudinary usando CLOUDINARY_URL del .env
// Formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (!process.env.CLOUDINARY_URL) {
  console.warn('⚠️  CLOUDINARY_URL no está configurada en las variables de entorno')
} else {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  })
  console.log('✅ Cloudinary configurado correctamente')
}

export { cloudinary }
