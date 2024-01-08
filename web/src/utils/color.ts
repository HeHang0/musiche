import { parseHttpProxyAddress } from './http';
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
    const imageData = await ThemeColorManager.getImageData(realImgUrl);
    if (!imageData) {
      ThemeColorManager.imageParsed(imgUrl, null);
      return;
    }
    const themeColor = ThemeColorManager.getThemeColorFromImageData(imageData);
    ThemeColorManager.imageParsed(imgUrl, themeColor);
  }

  private static imageParsed(imgUrl: string, result: ThemeColor | null) {
    if (result) {
      ThemeColorManager.colorCache.set(imgUrl, result);
    }
    ThemeColorManager.colorProcessing.get(imgUrl)?.forEach(cb => cb(result));
    ThemeColorManager.colorProcessing.delete(imgUrl);
  }

  private static async getImageData(imgUrl: string): Promise<ImageData | null> {
    var image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = imgUrl;
    await new Promise(resolve => {
      image.onload = resolve;
      image.onerror = resolve;
    });
    let width = image.width;
    let height = image.height;
    let shrinkFactor = 10;
    let shrinkWidth = width / shrinkFactor;
    let shrinkHeight = height / shrinkFactor;
    let canvas = document.createElement('canvas');
    canvas.setAttribute('width', `${shrinkWidth}px`);
    canvas.setAttribute('height', `${shrinkHeight}px`);
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, shrinkWidth, shrinkHeight);
    ctx.filter = 'blur(26px)';
    let imageData: ImageDataSettings | null = null;
    try {
      imageData = ctx.getImageData(0, 0, width, height);
    } catch (error) {
      console.log(error);
    }
    image.remove();
    canvas.remove();
    return imageData;
  }

  // 开始筛选主题色
  private static getThemeColorFromImageData(
    originalPixels: ImageData
  ): ThemeColor | null {
    if (
      !originalPixels ||
      !originalPixels.data ||
      originalPixels.data.length == 0
    ) {
      return null;
    }
    let rMax = 0;
    let gMax = 0;
    let bMax = 0;
    let count = 0;
    for (let i = 0; i < originalPixels.data.length; i += 4) {
      let r = originalPixels.data[i];
      let g = originalPixels.data[i + 1];
      let b = originalPixels.data[i + 2];
      let a = originalPixels.data[i + 3] / 255.0;
      if (a > 0 && r < 250 && g < 250 && b < 250 && r > 9 && g > 9 && b > 9) {
        rMax += r;
        gMax += g;
        bMax += b;
        count++;
      }
    }
    const [rValue, gValue, bValue] = this.adjustNumbers(
      Math.round(rMax / count),
      Math.round(gMax / count),
      Math.round(bMax / count)
    );
    return {
      red: rValue,
      green: gValue,
      blue: bValue,
      alpha: 1,
      dark: (rValue + gValue + bValue) / 3 < 128
    };
  }
  private static adjustNumbers(a: number, b: number, c: number) {
    const numbers = [a, b, c];
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const middle = numbers.find(num => num !== min && num !== max);

    const adjustedMin = Math.max(0, Math.min(min - 10, 255));
    const adjustedMiddle = Math.max(0, Math.min(middle! - 5, 255));

    return numbers.map(num => {
      if (num === min) return adjustedMin;
      if (num === middle) return adjustedMiddle;
      return num;
    });
  }
}
