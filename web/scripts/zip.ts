import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { execSync } from 'child_process';

function buildVersion(output: string = null) {
  if (!output) output = path.resolve('dist');
  const csProj = path.resolve('../windows/Musiche.csproj');
  const text = fs.existsSync(csProj)
    ? fs.readFileSync(csProj, {
        encoding: 'utf8'
      })
    : '';
  const regex = /<Version>(.*)<\/Version>/;
  const match = regex.exec(text);
  const version = (match && match[1]) || '2.0.0';
  const outFile = path.resolve(output, 'version');
  const commitHash = execSync('git rev-parse --short HEAD', {
    encoding: 'utf8'
  });
  const now = new Date();
  fs.writeFileSync(
    outFile,
    `${version}-${commitHash} (${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')})`
  );
}

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
      buildVersion();
      makeZip();
    }
  };
};
