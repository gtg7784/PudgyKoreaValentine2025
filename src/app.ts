import * as dotenv from "dotenv";
import { Address, toNano } from '@ton/core';
import { readdir, readFile, writeFile, rm } from "fs/promises";
import { updateMetadataFiles, uploadFolderToIPFS } from "./metadata";
import { openWallet } from "./utils";
import { waitSeqno } from "./delay";
import { NftCollection } from "./contracts/NftCollection";
import { NftItem } from "./contracts/NftItem";
import { NftMarketplace } from "./contracts/NftMarketplace";

dotenv.config();

const AMOUNT = 100 as const;

const METADATA_FOLDER_PATH = "./data/metadata/";
const IMAGES_FOLDER_PATH = "./data/images/";

const METADATA_FILE_PATH = "./data/metadata.json";
const IMAGE_FILE_PATH = "./data/image.jpg";
const COLLECTION_FILE_PATH = "./data/collection.json";

async function prepareFiles() {
  console.log("Started removing old images...");

  const oldImageFiles = await readdir(IMAGES_FOLDER_PATH);

  for (const file of oldImageFiles) {
    if (file === ".gitkeep") {
      continue;
    }

    await rm(IMAGES_FOLDER_PATH + file);
  }

  console.log("Successfully removed old images");

  console.log("Started removing old metadata...");

  const oldMetadataFiles = await readdir(METADATA_FOLDER_PATH);

  for (const file of oldMetadataFiles) {
    if (file === ".gitkeep") {
      continue;
    }

    await rm(METADATA_FOLDER_PATH + file);
  }

  console.log("Successfully removed old metadata");

  const imageFile = await readFile(IMAGE_FILE_PATH);

  for (let i = 0; i < AMOUNT; i++) {
    const imageNumber = i + 1;
    const newImageFilePath = IMAGES_FOLDER_PATH + `${imageNumber}.jpg`;

    await writeFile(newImageFilePath, imageFile);
  }

  const logoFilePath = IMAGES_FOLDER_PATH + "logo.jpg";

  await writeFile(logoFilePath, imageFile);

  console.log("Successfully copied the images");

  console.log("Started copying metadata...");

  const collectionMetadataFile = await readFile(COLLECTION_FILE_PATH);
  
  const collectionMetadata = JSON.parse(collectionMetadataFile.toString());
  collectionMetadata.image = `ipfs://images/logo.jpg`;

  await writeFile(METADATA_FOLDER_PATH + "collection.json", JSON.stringify(collectionMetadata));

  const metadataFile = await readFile(METADATA_FILE_PATH);

  for (let i = 0; i < AMOUNT; i++) {
    const metadataNumber = i + 1;
    const newMetadataFilePath = METADATA_FOLDER_PATH + `${metadataNumber}.json`;

    const metadata = JSON.parse(metadataFile.toString());

    metadata.name = `${metadata.name}${metadataNumber}`;

    await writeFile(newMetadataFilePath, JSON.stringify(metadata));
  }

  console.log("Successfully copied the metadata");
}

async function init() {
  const nemonic = process.env.MNEMONIC!.split(" ");
  const wallet = await openWallet(nemonic, true);

  if (wallet == null) {
    console.error("Failed to open wallet");
    return;
  }

  await prepareFiles();

  console.log("Started uploading images to IPFS...");
  await rm(IMAGES_FOLDER_PATH + ".gitkeep");

  const imagesIpfsHash = await uploadFolderToIPFS(IMAGES_FOLDER_PATH);

  await writeFile(IMAGES_FOLDER_PATH + ".gitkeep", "");

  console.log(
    `Successfully uploaded the pictures to ipfs: https://gateway.pinata.cloud/ipfs/${imagesIpfsHash}`
  );

  console.log("Started uploading metadata files to IPFS...");

  await rm(METADATA_FOLDER_PATH + ".gitkeep");

  await updateMetadataFiles(METADATA_FOLDER_PATH, imagesIpfsHash);
  const metadataIpfsHash = await uploadFolderToIPFS(METADATA_FOLDER_PATH);

  await writeFile(METADATA_FOLDER_PATH + ".gitkeep", "");

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

async function additionalMint(from: number = 0, to: number = 1) {
  const metadataIpfsHash = "QmdEaNtU3oF4uReaAxfS8m2jzHLL2xARuQrJRfresWK1Xm"
  const nftCollectionAddress = Address.parse("EQBp1VtboMtxrHF-AO27sGK-gfZ7w7lyN5BCs4dX4lKnotpp");
  const nemonic = process.env.MNEMONIC!.split(" ");

  const wallet = await openWallet(nemonic, true);

  if (wallet == null) {
    console.error("Failed to open wallet");
    return;
  }

  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0, // 0%, no royalties
    royaltyAddress: wallet.contract.address,
    nextItemIndex: 0,
    collectionContentUrl: `ipfs://${metadataIpfsHash}/collection.json`,
    commonContentUrl: `ipfs://${metadataIpfsHash}/`,
  };

  const collection = new NftCollection(collectionData, nftCollectionAddress);

  let files = await readdir(METADATA_FOLDER_PATH);
  files.shift()
  files.pop();
  let index = from;

  files = files.sort((a, b) => {
    const aNum = parseInt(a.split(".")[0]);
    const bNum = parseInt(b.split(".")[0]);
    return aNum - bNum;
  });

  files = files.slice(from, to);

  console.log(files)

  let seqno;

  for (const file of files) {
    console.log(`Start deploy of ${file} NFT`);
    const mintParams = {
      queryId: 0,
      itemOwnerAddress: wallet.contract.address,
      itemIndex: index,
      amount: toNano("0.05"),
      commonContentUrl: file,
    };

    const nftItem = new NftItem(collection);
    seqno = await nftItem.deploy(wallet, mintParams);
    console.log(`Successfully deployed ${file} NFT`);
    await waitSeqno(seqno, wallet);
    index++;
  }
}

// void init();
void additionalMint(24, 30)