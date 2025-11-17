// Esto le dice a TypeScript que cualquier archivo que termine en .pem
// puede ser importado y su contenido será un string.
declare module '*.pem' {
  const content: string;
  export default content;
}