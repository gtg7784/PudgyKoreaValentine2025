import { internal, SendMode, Address, beginCell, Cell, toNano } from "@ton/core";
import { OpenedWallet } from "utils";
import { NftCollection, mintParams } from "./NftCollection";
import { TonClient } from "@ton/ton";
import { isAxiosError } from "axios";

export class NftItem {
  private collection: NftCollection;

  constructor(collection: NftCollection) {
    this.collection = collection;
  }

  public async deploy(
    wallet: OpenedWallet,
    params: mintParams
  ): Promise<number> {
    const seqno = await wallet.contract.getSeqno();
    try {
      await wallet.contract.sendTransfer({
        seqno,
        secretKey: wallet.keyPair.secretKey,
        messages: [
          internal({
            value: "0.05",
            to: this.collection.address,
            body: this.collection.createMintBody(params),
          }),
        ],
        sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
      });
    } catch (error) {
      if (isAxiosError(error)) {
        console.error(error.response?.data);
      } else {
        console.error(error);
      }
    }
    return seqno;
  }

  static async getAddressByIndex(
    collectionAddress: Address,
    itemIndex: number
  ): Promise<Address> {
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const response = await client.runMethod(
      collectionAddress,
      "get_nft_address_by_index",
      [{ type: "int", value: BigInt(itemIndex) }]
    );

    return response.stack.readAddress();
  }
}