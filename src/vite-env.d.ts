/// <reference types="vite/client" />

// CSS modules
declare module '*.css' {
  const content: string;
  export default content;
}
