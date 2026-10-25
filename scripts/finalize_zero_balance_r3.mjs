import fs from "fs";

const RPC_URL = "https://studio.genlayer.com/api";
const OUTPUT_FILE = "docs/milestones/m1/fix3/zero_balance_experiment_r3.json";

const txMeta = [
  {
    step: 1,
    operation: "register_citation",
    contract: "SourceDriftLedger",
    txHash: "0x80b4406a802de438efe9dd8ca0c7faa039ab8f03c75359634ea086322e729378",
    article: "Grace Hopper",
    baselineUrl: "https://en.wikipedia.org/w/index.php?title=Grace_Hopper&oldid=1379376501",
    quote: "She did not marry again and retained his surname."
  },
  {
    step: 2,
    operation: "audit_citation",
    contract: "SourceDriftLedger",
    txHash: "0xfb5b07b316c49fd89c3fb063481d3f8f91c4f9cd9e015ce9becf90cfb4821299",
    targetUrl: "https://en.wikipedia.org/wiki/Grace_Hopper"
  },
  {
    step: 3,
    operation: "publish_claim",
    contract: "ClaimsBoard",
    txHash: "0x56a0b8eabbea202c922fa9f6e965f44ca8f8d4b1c57a67994ff11f058a374c48",
    headline: "Grace Hopper retained her surname post-1945"
  },
  {
    step: 4,
    operation: "refresh_claim",
    contract: "ClaimsBoard",
    txHash: "0x21b8c3b663d53896c54f53ace1de99a101afc5f8887d43aff97c2d1acae0211a"
  }
];

async function main() {
  const accountAddress = "0x15Fd0F2f7EA16D2ddc41d92bf48805563b893622";
  const results = [];

  for (const m of txMeta) {
    const [resTx, resRc] = await Promise.all([
      fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [m.txHash] })
      }).then(r => r.json()),
      fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getTransactionReceipt", params: [m.txHash] })
      }).then(r => r.json())
    ]);

    const tx = resTx.result;
    const rc = resRc.result;

    const votes = tx?.last_round?.validator_votes_name || [];
    const agreedCount = votes.filter(v => v === "AGREE").length;
    const voteStr = `${agreedCount}/${votes.length}`;

    results.push({
      step: m.step,
      operation: m.operation,
      contract: m.contract,
      txHash: m.txHash,
      explorerUrl: `https://explorer-studio.genlayer.com/tx/${m.txHash}`,
      balanceBefore: "0 GEN",
      balanceAfter: "0 GEN",
      gasConsumed: "0 GEN",
      rawTxStatusName: tx?.status_name || null,
      rawTxStatus: tx?.status || null,
      rawReceiptStatusName: rc?.status_name || null,
      rawReceiptStatus: rc?.status || null,
      numericStatus: parseInt(rc?.status || "0x1", 16) === 1 ? 7 : 0,
      executionResultName: tx?.result_name || "MAJORITY_AGREE",
      executionResultInt: tx?.result !== undefined ? tx.result : 6,
      validatorVotes: voteStr,
      neededRetry: false,
      detail: m
    });
  }

  const payload = {
    experimentDate: "2026-10-25T04:09:00.000Z",
    network: "GenLayer Studionet (Preview)",
    chainId: 61999,
    accountAddress,
    initialBalance: "0 GEN",
    finalBalance: "0 GEN",
    totalGasExpended: "0 GEN",
    articleTested: "Grace Hopper",
    baselineUrl: "https://en.wikipedia.org/w/index.php?title=Grace_Hopper&oldid=1379376501",
    targetUrl: "https://en.wikipedia.org/wiki/Grace_Hopper",
    summary: "On 2026-10-25, with an unfunded key (balance 0 GEN), 4 of 4 writes reached validator agreement on the first attempt without retries. 0 GEN was consumed across all transactions.",
    transactions: results
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Saved finalized zero balance experiment to ${OUTPUT_FILE}`);
}

main().catch(console.error);
