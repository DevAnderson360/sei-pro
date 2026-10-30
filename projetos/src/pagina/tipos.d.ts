/** O build importa CSS como texto (loader "text" do esbuild) para o Shadow DOM dos balões (pagina/balao.ts). */
declare module "*.css" {
  const texto: string;
  export default texto;
}
