import ColorThief from 'colorthief';
import { parseHttpProxyAddress } from './http';
const colorThief = new ColorThief();
export interface ThemeColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
  dark: boolean;
}

export class ThemeColorManager {
  private static colorCache = new Map<string, ThemeColor>();
  private static colorProcessing = new Map<
    string,
    ((value: ThemeColor | null) => void)[]
  >();
  public static getThemeColor(imgUrl: string): Promise<ThemeColor | null> {
    if (!imgUrl) return Promise.resolve(null);
    if (ThemeColorManager.colorCache.has(imgUrl)) {
      return Promise.resolve(ThemeColorManager.colorCache.get(imgUrl)!);
    }
    return new Promise<ThemeColor | null>((resolve, _reject) => {
      if (ThemeColorManager.colorProcessing.has(imgUrl)) {
        ThemeColorManager.colorProcessing.get(imgUrl)?.push(resolve);
        return;
      } else {
        ThemeColorManager.colorProcessing.set(imgUrl, [resolve]);
        ThemeColorManager.runParseThemeColor(imgUrl);
      }
    });
  }

  private static async runParseThemeColor(imgUrl: string) {
    const realImgUrl = imgUrl?.startsWith('http')
      ? parseHttpProxyAddress(imgUrl)
      : imgUrl;
    const themeColor = await ThemeColorManager.getThemeColorFromUrl(realImgUrl);
    ThemeColorManager.imageParsed(imgUrl, themeColor);
  }

  private static imageParsed(imgUrl: string, result: ThemeColor | null) {
    if (result) {
      ThemeColorManager.colorCache.set(imgUrl, result);
    }
    ThemeColorManager.colorProcessing.get(imgUrl)?.forEach(cb => cb(result));
    ThemeColorManager.colorProcessing.delete(imgUrl);
  }

  private static async getThemeColorFromUrl(
    imgUrl: string
  ): Promise<ThemeColor> {
    var image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = imgUrl;
    await new Promise(resolve => {
      image.onload = resolve;
      image.onerror = resolve;
    });
    let color = [0, 0, 0];
    try {
      color = await colorThief.getColor(image);
    } catch (error) {
      console.log('color thief error', imgUrl, error);
    }
    image.remove();
    return {
      red: color[0],
      green: color[1],
      blue: color[2],
      alpha: 1,
      dark: color.reduce((a, b) => a + b, 0) / 3 < 128
    };
  }
}
