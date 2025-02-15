import { Helius } from "helius-sdk";
import dotenv from 'dotenv';
import { Connection, PublicKey } from '@solana/web3.js';
import { sendDiscordWebhook } from "./webhook";
import express from 'express';

dotenv.config();

const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const required = ['HELIUS_API_KEY', 'HELIUS_HTTP_URL', 'HELIUS_WSS_URL', 'DISCORD_WEBHOOK_URL'];
const missing = required.filter(key => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const programId = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const helius = new Helius(process.env.HELIUS_API_KEY!);
const connection = new Connection(process.env.HELIUS_HTTP_URL!, {wsEndpoint: process.env.HELIUS_WSS_URL!});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

async function isLbPair(token: string) {
  const data = await connection.getAccountInfo(new PublicKey(token));
  return data?.owner.toString() === "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
}

async function parseTx(signature: string) {
  try {
    const response = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
    
    if (!response?.transaction?.message.staticAccountKeys) {
      throw new Error('Invalid transaction data');
    }

    const keys = response.transaction.message.staticAccountKeys;
    
    let lbPair = '';
    const tokenProgramIndex = keys.findIndex(key => 
      key.toString() === '11111111111111111111111111111111'
    );
    
    for (let i = tokenProgramIndex; i >= 0; i--) {
      const key = keys[i].toString();
      if (await isLbPair(key)) {
        lbPair = key;
        break;
      }
    }
    
    const tokenProgramIndex2 = keys.findIndex(key => 
      key.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    const tokenX = keys[tokenProgramIndex2 + 1].toString();
    const tokenY = "USDC"
    

    const info = await helius.rpc.getAsset({
      id: tokenX,
      displayOptions: {
        showCollectionMetadata: true,
      },
    });

    return {
      tx: signature,
      tokenX,
      tokenY,
      lbPair,
      tokenXname: info?.content?.metadata.name || "Unknown",
      symbol: info?.content?.metadata.symbol || "Unknown",
    };
    
  } catch (error) {
    log(`Error parsing transaction ${signature}: ${error}`);
    return null;
  }
}



async function main() {
  try {
    const subscriptionId = connection.onLogs(
      programId,
      async (logData) => {
        try {
          const { signature, logs } = logData;

          if (logs.some((line) => line.includes("Instruction: InitializeCustomizablePermissionlessLbPair"))) {
            log(`Detected DLMM creation tx: ${signature}`);
            const payload = await parseTx(signature);
            if (payload) {
              await sendDiscordWebhook(payload);
              log('Discord webhook sent successfully');
            }
          }
        } catch (error) {
          log(`Error processing log data: ${error}`);
        }
      },
      "finalized" 
    );

    log(`Subscribed to logs for program: ${programId.toBase58()}`);
    log(`Subscription ID: ${subscriptionId}`);
  } catch (error) {
    log(`Error in main: ${error}`);
    setTimeout(main, 5000);
  }
}


main().catch(error => {
  log(`Fatal error: ${error}`);
  process.exit(1);
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



