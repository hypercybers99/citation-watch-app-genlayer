import fs from "fs";

const RPC = "https://studio.genlayer.com/api";

const e2eHashes = [
  { op: "register_citation", hash: "0xdb3ebfb2092f203eb610c620b883d46682d9d3bc330205cc95929bca204a4050" },
  { op: "audit_citation", hash: "0x157c801d8b220ec37b2a32fed473c71a25f6f3574e84b3eeb9b49748e37bdc82" },
  { op: "publish_claim", hash: "0x3e1493a782666f04f68b2c227816d2ede4ee89031df61bfab6a5bd22c45ce7b5" },
  { op: "refresh_claim", hash: "0x506b8233a22cbaac917293961556b290cd5dd43a4ca23f39c2817522fe968936" },
  { op: "negative_flow (set_ledger_address)", hash: "0x83ed33a0e709b0e877206a30cd4f0a8bdc91eed7fc1ccc37c55f9744d569def7" },
  { op: "disagreed_tx (audit_citation)", hash: "0xe33c653ad027caaa4c00f5640e473d8d40dabe80e447bfbc3b8b04de65f4d017" }
];

const zeroHashes = [
  { op: "register_citation (0-bal)", hash: "0x7a78b8792795552c188d575e954fe4ca97a613b9014fd67ed9494ce8f103ac42" },
  { op: "audit_citation (0-bal)", hash: "0x215b97d8443ba6acbf41ca9c2c6eba8846942d360867cf7c7312d8da7221f38d" },
  { op: "publish_claim (0-bal)", hash: "0xc0781284685d45eab82a78030da22dee2a810a398374d52ce9b97975ddd33747" },
  { op: "refresh_claim (0-bal)", hash: "0x41cbfc7e985fd25f40062abe3eff9050b62f52a420facc8b65ecbe1b2c36e5eb" }
];

async function callRpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const json = await res.json();
  return json.result;
}

async function inspectAll() {
  const all = [...e2eHashes.map(x => ({ ...x, group: "E2E R2" })), ...zeroHashes.map(x => ({ ...x, group: "Zero-Bal" }))];
  const results = [];
  for (const item of all) {
    const tx = await callRpc("eth_getTransactionByHash", [item.hash]);
    const receipt = await callRpc("eth_getTransactionReceipt", [item.hash]);
    
    const votes = tx?.consensus_data?.votes || {};
    const agree = Object.values(votes).filter(v => v === "agree" || v?.vote === "agree").length;
    const total = Object.keys(votes).length;

    results.push({
      group: item.group,
      op: item.op,
      hash: item.hash,
      tx_status_name: tx?.status_name ?? null,
      tx_status: tx?.status ?? null,
      receipt_status_name: receipt?.status_name ?? null,
      receipt_status: receipt?.status ?? null,
      result: tx?.result ?? null,
      result_name: tx?.result_name ?? null,
      votes: total > 0 ? `${agree}/${total}` : "N/A"
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

inspectAll().catch(console.error);
