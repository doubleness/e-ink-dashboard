import { fileURLToPath } from "node:url";
import sharp from "sharp";

const port = Number(process.env.PORT ?? 3000);
const pageUrl = "https://www.shmu.sk/sk/?page=1&id=meteo_num_mgram&nwp_mesto=32737";
const cropTop = 41;
const sectionHeight = 143;
const sectionsToKeep = [0, 1, 2, 4];
const jpgWidth = 1000;
const lightColor = 0xcc;
const redColor = 0x22;
const blueColor = 0x44;
const pngOutputPath = new URL("../aladin.png", import.meta.url);
const jpgOutputPath = new URL("../aladin.jpg", import.meta.url);

function findImageUrl(html: string) {
  const imageTag = html.match(/<img\b[^>]*\bid=["']imageArea["'][^>]*>/i)?.[0];
  const imageSrc = imageTag?.match(/\bsrc=["']([^"']+)["']/i)?.[1];

  if (!imageSrc) {
    throw new Error('Could not find image src for <img id="imageArea">');
  }

  return new URL(imageSrc, pageUrl).toString();
}

async function buildSectionImage(image: Buffer, width: number, height: number) {
  const neededHeight = cropTop + (Math.max(...sectionsToKeep) + 1) * sectionHeight;

  if (height < neededHeight) {
    throw new Error(`Downloaded image is too small for requested sections: ${width}x${height}`);
  }

  const sectionImages = await Promise.all(
    sectionsToKeep.map((sectionIndex) =>
      sharp(image)
        .extract({
          left: 3,
          top: cropTop + sectionIndex * sectionHeight,
          width: width - 3,
          height: sectionHeight,
        })
        .png()
        .toBuffer(),
    ),
  );

  return sharp({
    create: {
      width: width - 1,
      height: sectionHeight * sectionsToKeep.length,
      channels: 3,
      background: "white",
    },
  })
    .composite(
      sectionImages.map((sectionImage, index) => ({
        input: sectionImage,
        left: 0,
        top: index * sectionHeight,
      })),
    )
    .png()
    .toBuffer();
}

async function adjustInfographicColors(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    if (
      (red === 255 && green === 255 && blue === 51) ||
      (red === 153 && green === 255 && blue === 153) ||
      (red === 0 && green === 255 && blue === 0)
    ) {
      data[index] = lightColor;
      data[index + 1] = lightColor;
      data[index + 2] = lightColor;
    }

    if (red === 255 && green === 50 && blue === 50) {
      data[index] = redColor;
      data[index + 1] = redColor;
      data[index + 2] = redColor;
    }

    if (red === 0 && green === 100 && blue === 255) {
      data[index] = blueColor;
      data[index + 1] = blueColor;
      data[index + 2] = blueColor;
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function downloadAladin() {
  const pageResponse = await fetch(pageUrl);

  if (!pageResponse.ok) {
    throw new Error(`Failed to load page: ${pageResponse.status} ${pageResponse.statusText}`);
  }

  const imageUrl = findImageUrl(await pageResponse.text());
  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
    );
  }

  const image = Buffer.from(await imageResponse.arrayBuffer());
  const sourceImage = sharp(image);
  const metadata = await sourceImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read downloaded image dimensions");
  }

  const sectionImage = await buildSectionImage(image, metadata.width, metadata.height);
  const readableSectionImage = await adjustInfographicColors(sectionImage);
  await Bun.write(pngOutputPath, readableSectionImage);

  await sharp(readableSectionImage)
    .recomb([
      [0.18, 0.22, 0.6],
      [0.18, 0.22, 0.6],
      [0.18, 0.22, 0.6],
    ])
    .normalise()
    .sharpen()
    .resize({ width: jpgWidth })
    .jpeg({ quality: 90 })
    .toFile(fileURLToPath(jpgOutputPath));

  console.log(`Downloaded ${imageUrl}`);
  console.log(`Saved aladin.png (${readableSectionImage.byteLength} bytes)`);
  console.log("Saved grayscale aladin.jpg");
}

Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/aladin") {
      try {
        await downloadAladin();

        return new Response(Bun.file(jpgOutputPath), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        console.error(error);

        return new Response("Failed to prepare ALADIN image", { status: 500 });
      }
    }

    if (url.pathname === "/") {
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running at http://0.0.0.0:${port}`);
