import { parseHttpProxyAddress } from './http';

const colorCache = new Map<string, string>();

export class ThemeColor {
  // 原图资源
  imgUrl = '';
  // 像素集合
  originalPixels?: ImageData;
  // 主色
  themeColor = 'white';
  // 回调
  themeColorCallBack?: (themeColor: string) => void;
  // 提取像素出现最大次数操作对象
  colorCountedSet = new ColorCountedSet();

  constructor(imgUrl: string, callback: (themeColor: string) => void) {
    if (colorCache.get(imgUrl)) {
      callback(colorCache.get(imgUrl)!);
      return;
    }
    this.imgUrl = parseHttpProxyAddress(imgUrl);
    this.themeColorCallBack = callback;
    this.startScreeningThemeColor();
  }

  // 开始解析主色
  async startScreeningThemeColor() {
    try {
      await this.shrinkImage();
    } catch (error) {
      console.log('shrinkImage error:' + error);
    }
    this.screeningThemeColor();
  }

  // 图片缩小
  async shrinkImage() {
    var image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = this.imgUrl;
    await new Promise(resolve => {
      image.onload = resolve;
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
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, shrinkWidth, shrinkHeight);
    ctx.filter = 'blur(26px)';
    try {
      //保存像素
      this.originalPixels = ctx.getImageData(0, 0, width, height);
    } catch (error) {
      console.log(error);
    }
    image.remove();
    canvas.remove();
  }

  // 开始筛选主题色
  screeningThemeColor() {
    if (
      !this.originalPixels ||
      !this.originalPixels.data ||
      this.originalPixels.data.length == 0
    ) {
      throw '像素为空';
    }
    let rMax = 0;
    let gMax = 0;
    let bMax = 0;
    let count = 0;
    for (let i = 0; i < this.originalPixels.data.length; i += 4) {
      let r = this.originalPixels.data[i];
      let g = this.originalPixels.data[i + 1];
      let b = this.originalPixels.data[i + 2];
      let a = this.originalPixels.data[i + 3] / 255.0;
      //添加一个色值范围，让它能忽略一定无效的像素值
      if (
        a > 0
        // &&
        // r < 200 &&
        // g < 200 &&
        // b < 200 &&
        // r > 50 &&
        // g > 50 &&
        // b > 50
      ) {
        // this.colorCountedSet.push(r, g, b, a);
        rMax += r;
        gMax += g;
        bMax += b;
        count++;
      }
    }

    // let rValue = Math.round(rMax / count);
    // let gValue = Math.round(gMax / count);
    // let bValue = Math.round(bMax / count);
    // const colorMin = Math.min(rValue, gValue, bValue);
    // console.log(this.imgUrl);
    // console.log('原色', rValue, gValue, bValue);
    // if (colorMin == rValue) {
    //   rValue -= 10;
    //   gValue -= 20;
    //   bValue -= 20;
    // }
    // if (colorMin == gValue) {
    //   rValue -= 20;
    //   gValue -= 10;
    //   bValue -= 20;
    // }
    // if (colorMin == bValue) {
    //   rValue -= 20;
    //   gValue -= 20;
    //   bValue -= 10;
    // }
    const [rValue, gValue, bValue] = this.adjustNumbers(
      Math.round(rMax / count),
      Math.round(gMax / count),
      Math.round(bMax / count)
    );
    this.themeColor = `rgba(${rValue},${gValue},${bValue},1)`;
    colorCache.set(this.imgUrl, this.themeColor);
    // let maxCount = 0;
    // // 寻找出现次数最多的像素定为主色调
    // this.colorCountedSet.forEach((value: number, key: string) => {
    //   if (maxCount <= value) {
    //     maxCount = value;
    //     this.themeColor = 'rgba(' + key + ')';
    //   }
    // });
    //执行回调
    if (this.themeColorCallBack) {
      this.themeColorCallBack(this.themeColor);
    }
  }
  adjustNumbers(a: number, b: number, c: number) {
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

// 统计不同像素的出现次数
class ColorCountedSet {
  //像素集合
  map = new Map();

  //添加像素到集合
  push(r: number, g: number, b: number, a: number) {
    //根据像素值生成一个map 元素 key值
    let identification = r + ',' + g + ',' + b + ',' + a;
    if (!this.map.get(identification)) {
      this.map.set(identification, 1);
    } else {
      // 存在进行次数自增
      let times = parseInt(this.map.get(identification)) + 1;
      this.map.set(identification, times);
    }
  }

  // 给 ColorCountedSet 操作类添加一个 forEach 方法
  forEach(cb: (value: number, key: string) => void) {
    this.map.forEach(function (value, key) {
      cb(value, key);
    });
  }
}
