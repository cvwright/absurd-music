/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// CSS modules
declare module '*.css' {
  const content: string;
  export default content;
}
