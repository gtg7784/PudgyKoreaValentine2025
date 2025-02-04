import * as dotenv from "dotenv";
import { readdir, readFile, writeFile, rm } from "fs/promises";
import { updateMetadataFiles, uploadFolderToIPFS } from "./metadata";
import { openWallet } from "./utils";
import { waitSeqno } from "./delay";
import { NftCollection } from "./contracts/NftCollection";

dotenv.config();

const AMOUNT = 100 as const;

async function init() {
  const metadataFolderPath = "./data/metadata/";
  const imagesFolderPath = "./data/images/";

  const metadataFilePath = "./data/metadata.json";
  const imageFilePath = "./data/image.jpg";
  const collectionFilePath = "./data/collection.json";

  const nemonic = process.env.MNEMONIC!.split(" ");
  const wallet = await openWallet(nemonic, true);

  if (wallet == null) {
    console.error("Failed to open wallet");
    return;
  }

  console.log("Started removing old images...");

  const oldImageFiles = await readdir(imagesFolderPath);

  for (const file of oldImageFiles) {
    if (file === ".gitkeep") {
      continue;
    }

    await rm(imagesFolderPath + file);
  }

  console.log("Successfully removed old images");

  console.log("Started removing old metadata...");

  const oldMetadataFiles = await readdir(metadataFolderPath);

  for (const file of oldMetadataFiles) {
    if (file === ".gitkeep") {
      continue;
    }

    await rm(metadataFolderPath + file);
  }

  console.log("Successfully removed old metadata");

  const imageFile = await readFile(imageFilePath);

  for (let i = 0; i < AMOUNT; i++) {
    const imageNumber = i + 1;
    const newImageFilePath = imagesFolderPath + `${imageNumber}.jpg`;

    await writeFile(newImageFilePath, imageFile);
  }

  const logoFilePath = imagesFolderPath + "logo.jpg";

  await writeFile(logoFilePath, imageFile);

  console.log("Successfully copied the images");

  console.log("Started copying metadata...");

  const collectionFile = await readFile(collectionFilePath);

  await writeFile(metadataFolderPath + "collection.json", collectionFile);

  const metadataFile = await readFile(metadataFilePath);

  for (let i = 0; i < AMOUNT; i++) {
    const metadataNumber = i + 1;
    const newMetadataFilePath = metadataFolderPath + `${metadataNumber}.json`;

    await writeFile(newMetadataFilePath, metadataFile);
  }

  console.log("Successfully copied the metadata");

  console.log("Started uploading images to IPFS...");
  await rm(imagesFolderPath + ".gitkeep");

  const imagesIpfsHash = await uploadFolderToIPFS(imagesFolderPath);

  await writeFile(imagesFolderPath + ".gitkeep", "");

  console.log(
    `Successfully uploaded the pictures to ipfs: https://gateway.pinata.cloud/ipfs/${imagesIpfsHash}`
  );

  console.log("Started uploading metadata files to IPFS...");

  await rm(metadataFolderPath + ".gitkeep");

  await updateMetadataFiles(metadataFolderPath, imagesIpfsHash);
  const metadataIpfsHash = await uploadFolderToIPFS(metadataFolderPath);

  await writeFile(metadataFolderPath + ".gitkeep", "");

  console.log(
    `Successfully uploaded the metadata to ipfs: https://gateway.pinata.cloud/ipfs/${metadataIpfsHash}`
  );
  
  console.log("Start deploy of nft collection...");
  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0, // 0%, no royalties
    royaltyAddress: wallet.contract.address,
    nextItemIndex: 0,
    collectionContentUrl: `ipfs://${metadataIpfsHash}/collection.json`,
    commonContentUrl: `ipfs://${metadataIpfsHash}/`,
  };

  const collection = new NftCollection(collectionData);
  let seqno = await collection.deploy(wallet);
  console.log(`Collection deployed: ${collection.address}`);
  await waitSeqno(seqno, wallet);
}

void init();