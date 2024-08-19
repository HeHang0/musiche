declare module 'colorthief' {
  export default class ColorThief {
    getColor(
      image: HTMLImageElement,
      quality: number = 10
    ): Promise<[number, number, number]>;
    getPalette(
      image: HTMLImageElement,
      colorCount: number,
      quality: number = 10
    ): Promise<[number, number, number][]>;
  }
}
