declare module "config" {
  global {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    interface Window { backend: any }
  }
}