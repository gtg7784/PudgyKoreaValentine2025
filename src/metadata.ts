import pinataSDK from "@pinata/sdk";
import { readdirSync } from "fs";
import { writeFile, readFile } from "fs/promises";
import path from "path";

export async function uploadFolderToIPFS(folderPath: string): Promise<string> {
  const pinata = new pinataSDK({
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretApiKey: process.env.PINATA_API_SECRET,
  });

  const response = await pinata.pinFromFS(folderPath);

  return response.IpfsHash;
}

export async function updateMetadataFiles(metadataFolderPath: string, imagesIpfsHash: string): Promise<void> {
  const files = readdirSync(metadataFolderPath);

  files.forEach(async (filename, index) => {
    console.log(index, filename)
  });

  await Promise.all(files.map(async (filename, index) => {
    const filePath = path.join(metadataFolderPath, filename)
    if (!filename.includes("json")) {
      return;
    }

    const file = await readFile(filePath);

    const [metadataName] = filename.split(".");

    console.log(metadataName, filename)
    
    const metadata = JSON.parse(file.toString());
    metadata.image =
      metadataName === "collection"
        ? `ipfs://${imagesIpfsHash}/logo.jpg`
        : `ipfs://${imagesIpfsHash}/${metadataName}.jpg`

    console.log(metadata.image)
    
    await writeFile(filePath, JSON.stringify(metadata));
  }));
}
