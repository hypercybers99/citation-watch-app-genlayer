import fs from "fs";

const RPC_URL = "https://studio.genlayer.com/api";

const ALL_HASHES = [
  // 1. Production E2E R2 hashes
  { id: "r2_register", hash: "0xdb3ebfb2092f203eb610c620b883d46682d9d3bc330205cc95929bca204a4050", group: "Production E2E R2" },
  { id: "r2_audit", hash: "0x157c801d8b220ec37b2a32fed473c71a25f6f3574e84b3eeb9b49748e37bdc82", group: "Production E2E R2" },
  { id: "r2_publish", hash: "0x3e1493a782666f04f68b2c227816d2ede4ee89031df61bfab6a5bd22c45ce7b5", group: "Production E2E R2" },
  { id: "r2_refresh", hash: "0x506b8233a22cbaac917293961556b290cd5dd43a4ca23f39c2817522fe968936", group: "Production E2E R2" },
  { id: "r2_disagreed_audit", hash: "0xe33c653ad027caaa4c00f5640e473d8d40dabe80e447bfbc3b8b04de65f4d017", group: "Production E2E R2 Disagreed" },
  { id: "r2_negative_set_ledger", hash: "0x83ed33a0e709b0e877206a30cd4f0a8bdc91eed7fc1ccc37c55f9744d569def7", group: "Production E2E R2 Negative" },

  // 2. Zero-Balance R2 Experiment hashes (runner 0xE187...)
  { id: "z2_register_disagreed", hash: "0x7a78b8792795552c188d575e954fe4ca97a613b9014fd67ed9494ce8f103ac42", group: "Zero-Balance Exp R2" },
  { id: "z2_audit", hash: "0x215b97d8443ba6acbf41ca9c2c6eba8846942d360867cf7c7312d8da7221f38d", group: "Zero-Balance Exp R2" },
  { id: "z2_publish", hash: "0xc0781284685d45eab82a78030da22dee2a810a398374d52ce9b97975ddd33747", group: "Zero-Balance Exp R2" },
  { id: "z2_refresh", hash: "0x41cbfc7e985fd25f40062abe3eff9050b62f52a420facc8b65ecbe1b2c36e5eb", group: "Zero-Balance Exp R2" },

  // 3. Zero-Balance R3 Experiment hashes (runner 0x15Fd...)
  { id: "z3_register", hash: "0x80b4406a802de438efe9dd8ca0c7faa039ab8f03c75359634ea086322e729378", group: "Zero-Balance Exp R3" },
  { id: "z3_audit", hash: "0xfb5b07b316c49fd89c3fb063481d3f8f91c4f9cd9e015ce9becf90cfb4821299", group: "Zero-Balance Exp R3" },
  { id: "z3_publish", hash: "0x56a0b8eabbea202c922fa9f6e965f44ca8f8d4b1c57a67994ff11f058a374c48", group: "Zero-Balance Exp R3" },
  { id: "z3_refresh", hash: "0x21b8c3b663d53896c54f53ace1de99a101afc5f8887d43aff97c2d1acae0211a", group: "Zero-Balance Exp R3" },

  // 4. Retry transaction mentioned in 3.6
  { id: "m1_retry_tx", hash: "0xa4d49f6d371c7b9a59dd34d147d53561a64f2c99dc2506ae13fd1bc6e6de55b4", group: "Milestone 1 Retry Tx" },

  // 5. Original Milestone 1 E2E txs (runner 0xaB43...)
  { id: "m1_orig_register", hash: "0x93077c60796cba6beb5f50248f879938f778538084a72ff12c1c6623e72530c2", group: "Original Milestone 1 E2E" },
  { id: "m1_orig_audit1", hash: "0xc45a12acd32381da4a5c8bbeaec42768f89b28a365cec17d48422ba8c4e385c6", group: "Original Milestone 1 E2E" },
  { id: "m1_orig_audit2", hash: "0x238925f08a895adc6544b558ff0d00038b7d0f5410ae34fc30092857dc43f967", group: "Original Milestone 1 E2E" },
  { id: "m1_orig_publish", hash: "0xcad053b4826482c6306cb8f959530114897d5f4d19948189bb6a557c1e56fa40", group: "Original Milestone 1 E2E" },
  { id: "m1_orig_refresh", hash: "0xb3716a1966913a83fbabaad056e4e94c2012455f40dc1e39d2164dd8819c63c4", group: "Original Milestone 1 E2E" },
];

async function callRpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const json = await res.json();
  return json.result;
}

async function main() {
  const fetchTimestamp = new Date().toISOString();
  console.log(`Pulling raw RPC data at ${fetchTimestamp}...`);

  const dump = {
    fetchTimestamp,
    rpcUrl: RPC_URL,
    transactions: [],
  };

  for (const item of ALL_HASHES) {
    console.log(`Querying ${item.id}: ${item.hash}...`);
    try {
      const tx = await callRpc("eth_getTransactionByHash", [item.hash]);
      const receipt = await callRpc("eth_getTransactionReceipt", [item.hash]);

      dump.transactions.push({
        id: item.id,
        group: item.group,
        hash: item.hash,
        tx: tx || null,
        receipt: receipt || null,
      });
    } catch (err) {
      console.error(`Failed to fetch ${item.hash}:`, err.message);
      dump.transactions.push({
        id: item.id,
        group: item.group,
        hash: item.hash,
        error: err.message,
      });
    }
  }

  fs.mkdirSync("docs/milestones/m1/fix4", { recursive: true });
  fs.writeFileSync(
    "docs/milestones/m1/fix4/raw_rpc_dump.json",
    JSON.stringify(dump, null, 2),
    "utf8"
  );
  console.log("Saved raw RPC dump to docs/milestones/m1/fix4/raw_rpc_dump.json");
}

main();
