declare module 'neo-blessed' {
  const blessed: typeof import('blessed');
  export default blessed;
  export * from 'blessed';
}
