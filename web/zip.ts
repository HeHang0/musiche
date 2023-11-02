import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

export const ZipPlugin = function (
  fileName: string = 'web',
  output: string = null
) {
  if (!output) output = path.resolve('dist');
  fileName += '.zip';
  const makeZip = function () {
    const zip = new JSZip();
    const distPath = path.resolve(output);
    const readDir = function (allFolder: JSZip, dirPath: string) {
      const files = fs.readdirSync(dirPath);
      files.forEach(fileName => {
        const fillPath = path.join(dirPath, './', fileName);
        const file = fs.statSync(fillPath);
        if (file.isDirectory()) {
          const dirZip = allFolder.folder(fileName);
          readDir(dirZip, fillPath);
        } else {
          allFolder.file(fileName, fs.readFileSync(fillPath));
        }
      });
    };
    const removeExistedZip = () => {
      const dest = path.join(distPath, './' + fileName);
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
    };
    const zipDir = function () {
      readDir(zip, distPath);
      zip
        .generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: {
            level: 9
          }
        })
        .then(content => {
          const dest = path.join(distPath, '../' + fileName);
          removeExistedZip();
          fs.writeFileSync(dest, content);
        });
    };
    removeExistedZip();
    zipDir();
  };
  return {
    name: 'vite-plugin-auto-zip',
    apply: 'build',
    closeBundle() {
      makeZip();
    }
  };
};
