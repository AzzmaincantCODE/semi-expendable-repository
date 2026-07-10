import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';

async function convert() {
  try {
    const inputPath = path.resolve('src/assets/gso lgo.jpg');
    const outputPath = path.resolve('public/gso-logo.ico');

    console.log('Reading image:', inputPath);
    const pngBuffer = await sharp(inputPath)
      .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    
    console.log('Converting to ICO...');
    const icoBuffer = await pngToIco(pngBuffer);

    fs.writeFileSync(outputPath, icoBuffer);
    console.log('Successfully created:', outputPath);
  } catch (err) {
    console.error('Error:', err);
  }
}

convert();
