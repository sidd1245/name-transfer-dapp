let provider, signer, contract, userAddress;
let contractData;

window.onload = async () => {
  contractData = await fetch("contract.json").then(res => res.json());
  provider = new ethers.BrowserProvider(window.ethereum);
  contract = new ethers.Contract(contractData.address, contractData.abi, provider);

  document.getElementById("connectButton").onclick = toggleWallet;
  document.getElementById("registerBtn").onclick = registerName;
  document.getElementById("unregisterBtn").onclick = unregisterName;
  document.getElementById("sendBtn").onclick = sendFunds;
  document.getElementById("resolveBtn").onclick = resolveName;
  document.getElementById("reverseBtn").onclick = reverseLookup;

  document.querySelectorAll(".tablink").forEach(btn => {
    btn.onclick = () => openTab(btn.dataset.tab, btn);
  });

  const savedAccount = localStorage.getItem("connectedAccount");
  if (savedAccount) {
    await connectWallet();
  }
};

async function toggleWallet() {
  if (userAddress) {
    disconnectWallet();
  } else {
    await connectWallet();
  }
}

// ---------- connectWallet ----------
async function connectWallet() {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return;
  }

  try {
    // create provider + signer
    provider = new ethers.BrowserProvider(window.ethereum);
    // request accounts (prompts user if not already allowed)
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    // ensure contract is connected with signer (so writes work)
    // contract was created earlier with provider; connect to signer now:
    try {
      contract = contract.connect(signer);
    } catch {
      // fallback: recreate contract with signer
      contract = new ethers.Contract(contractData.address, contractData.abi, signer);
    }

    // persist selection
    localStorage.setItem("connectedAccount", userAddress);

    // update UI visibility: show tabs, hide welcome
    document.getElementById("welcomeMessage").style.display = "none";
    document.getElementById("tabs").style.display = "block";

    // show balance card
    document.getElementById("warningSection").style.display = "none";
    document.getElementById("balanceSection").style.display = "block";

    // show address + change button text
    document.getElementById("walletAddress").innerText = userAddress;
    document.getElementById("connectButton").innerText = "Disconnect Wallet";

    // populate everything
    await updateUI();

    // Optional: reload history automatically after connect
    // loadHistory(userAddress);

  } catch (err) {
    console.error("connectWallet error:", err);
  }
}




// ---------- disconnectWallet ----------
function disconnectWallet() {
  // remove stored account
  localStorage.removeItem("connectedAccount");
  userAddress = null;
  signer = null;

  // reset contract to read-only instance (connected to provider)
  contract = new ethers.Contract(contractData.address, contractData.abi, provider);

  // reset UI
  document.getElementById("walletAddress").innerText = "Not connected";
  document.getElementById("walletBalance").innerText = "";
  document.getElementById("walletName").innerText = "";
  document.getElementById("networkInfo").innerText = "";
  document.getElementById("connectButton").innerText = "Connect Wallet";

  // hide tabs, show welcome
  document.getElementById("tabs").style.display = "none";
  document.getElementById("welcomeMessage").style.display = "block";

  // hide balance card / show warning
  document.getElementById("balanceSection").style.display = "none";
  document.getElementById("warningSection").style.display = "block";

  // clear QR canvas safely
  const qr = document.getElementById("qrcode");
  if (qr && qr.getContext) {
    const ctx = qr.getContext("2d");
    ctx.clearRect(0, 0, qr.width || 200, qr.height || 200);
  }
}


// ---------- updateUI ----------
async function updateUI() {
  // don't proceed if not connected
  if (!userAddress || !provider) return;

  // local refs
  const copyBtn = document.getElementById("copyBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const qrCanvas = document.getElementById("qrcode");

  try {
    // Balance
    const balance = await provider.getBalance(userAddress);
    document.getElementById("walletBalance").innerText =
      `Balance: ${ethers.formatEther(balance)} ETH`;

    // Name (use the ABI function nameOf)
    let name = "";
    try {
      name = await contract.nameOf(userAddress);
    } catch (err) {
      // if nameOf fails for some reason, fallback to empty
      console.warn("nameOf call failed:", err);
      name = "";
    }

    if (name && name.length > 0) {
      document.getElementById("walletName").innerText = `Name: ${name}`;
      // hide register tab if name exists
      const regTab = document.getElementById("registerTab");
      if (regTab) regTab.style.display = "none";
    } else {
      document.getElementById("walletName").innerText = "No name registered";
      const regTab = document.getElementById("registerTab");
      if (regTab) regTab.style.display = "inline-block";
    }

    // Network
    const net = await provider.getNetwork();
    document.getElementById("networkInfo").innerText =
      `🌐 Network: ${net.name} (Chain ID: ${net.chainId})`;

    // QR code using the qrcode lib already included in index.html
    if (qrCanvas) {
      qrCanvas.width = 180;
      qrCanvas.height = 180;
      // clear first
      try { qrCanvas.getContext("2d").clearRect(0, 0, qrCanvas.width, qrCanvas.height); } catch (e) {}
      QRCode.toCanvas(qrCanvas, userAddress, { width: 180 }, function (error) {
        if (error) console.error("QR draw error", error);
      });
      qrCanvas.style.display = "block";
    }

    // show copy/refresh buttons if present
    if (copyBtn) copyBtn.style.display = "inline-block";
    if (refreshBtn) refreshBtn.style.display = "inline-block";

    // Optionally load history right away
    // loadHistory(userAddress);

  } catch (err) {
    console.error("updateUI error:", err);
  }
}


async function registerName() {
  if (!userAddress) {
    return alert("⚠️ Please connect your wallet before registering a name.");
  }
  const name = document.getElementById("registerInput").value.trim();
  if (!name) return alert("Enter a name");
  try {
    const tx = await contract.registerName(name);
    await tx.wait();
    alert(`✅ Name "${name}" registered successfully!`);
    updateUI();
  } catch (err) {
    if (err.message.includes("name already taken")) {
      alert("❌ This name is already registered by another wallet. Try a different one.");
    } else {
      alert("⚠️ Transaction failed: " + err.message);
    }
  }
}

async function unregisterName() {
  if (!userAddress) {
    return alert("⚠️ Please connect your wallet first.");
  }
  try {
    const tx = await contract.unregisterName();
    await tx.wait();
    alert("Name unregistered!");
    updateUI();
  } catch {
    alert("❌ Error unregistering name");
  }
}

async function sendFunds() {
  if (!userAddress) {
    return alert("⚠️ Please connect your wallet first.");
  }
  const toName = document.getElementById("sendToName").value.trim();
  const amount = document.getElementById("sendAmount").value.trim();
  if (!toName || !amount) return alert("Fill all fields");
  const tx = await contract.transferByName(toName, {
    value: ethers.parseEther(amount)
  });
  await tx.wait();
  alert(`Sent ${amount} ETH to ${toName}`);
  updateUI();
}

async function resolveName() {
  const name = document.getElementById("resolveInput").value.trim();
  if (!name) return alert("Enter a name");
  try {
    const address = await contract.resolveName(name);
    if (address === ethers.ZeroAddress) {
      document.getElementById("resolveResult").innerText = "❌ Not registered";
      document.getElementById("copyResolveBtn").style.display = "none";
      document.getElementById("resolveQr").getContext("2d").clearRect(0, 0, 200, 200);
    } else {
      document.getElementById("resolveResult").innerText = `✅ Address: ${address}`;
      document.getElementById("copyResolveBtn").style.display = "inline-block";
      document.getElementById("copyResolveBtn").onclick = () => copyToClipboard(address);
      QRCode.toCanvas(document.getElementById("resolveQr"), address, { width: 180 });
    }
  } catch {
    document.getElementById("resolveResult").innerText = "❌ Error resolving";
  }
}

async function reverseLookup() {
  const addr = document.getElementById("reverseInput").value.trim();
  if (!addr) return alert("Enter an address");
  try {
    const name = await contract.nameOf(addr);
    if (name) {
      document.getElementById("reverseResult").innerText = `✅ Registered Name: ${name}`;
    } else {
      document.getElementById("reverseResult").innerText = "❌ No name registered";
    }
  } catch {
    document.getElementById("reverseResult").innerText = "❌ Invalid address or error";
  }
}

// ---------- loadHistory (robust filter-by-parse) ----------
async function loadHistory(userAddress) {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  if (!userAddress) {
    historyList.innerHTML = "<li>⚠️ Connect your wallet first to view transaction history</li>";
    return;
  }

  try {
    // fetch all logs for this contract (may be heavy on mainnet; acceptable for small demo/testnets)
    const logs = await provider.getLogs({
      address: contractData.address,
      fromBlock: 0,
      toBlock: "latest"
    });

    const iface = new ethers.Interface(contractData.abi);

    // parse and filter logs that involve this user
    const matched = [];
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        if (!parsed) continue;

        // NameRegistered: owner indexed => parsed.args.owner
        if (parsed.name === "NameRegistered" && parsed.args.owner.toLowerCase() === userAddress.toLowerCase()) {
          matched.push({ parsed, raw: log });
          continue;
        }

        // SentByName: check from OR toAddress
        if (parsed.name === "SentByName") {
          const from = parsed.args.from?.toLowerCase?.() || "";
          const toAddress = parsed.args.toAddress?.toLowerCase?.() || "";
          if (from === userAddress.toLowerCase() || toAddress === userAddress.toLowerCase()) {
            matched.push({ parsed, raw: log });
            continue;
          }
        }

      } catch (e) {
        // ignore parse errors for non-matching logs
      }
    }

    if (matched.length === 0) {
      historyList.innerHTML = "<li>No history found for this account</li>";
      return;
    }

    // show recent up to last 30
    const slice = matched.slice(-30);
    for (const entry of slice) {
      const parsed = entry.parsed;
      const log = entry.raw;
      let summary = "";

      if (parsed.name === "NameRegistered") {
        summary = `🆕 Registered: ${parsed.args.name}`;
      } else if (parsed.name === "SentByName") {
        const amount = ethers.formatEther(parsed.args.amount);
        if (parsed.args.from.toLowerCase() === userAddress.toLowerCase()) {
          summary = `💸 Sent ${amount} ETH → ${parsed.args.toName}`;
        } else if (parsed.args.toAddress.toLowerCase() === userAddress.toLowerCase()) {
          summary = `💰 Received ${amount} ETH ← ${parsed.args.from}`;
        }
      }

      if (summary) {
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="summary">${summary}</div>
          <div class="details" style="display:none;">Loading...</div>
        `;

        li.querySelector(".summary").onclick = async () => {
          const detailsDiv = li.querySelector(".details");
          if (detailsDiv.style.display === "none") {
            try {
              const tx = await provider.getTransaction(log.transactionHash);
              const receipt = await provider.getTransactionReceipt(log.transactionHash);
              detailsDiv.innerHTML = `
                <strong>Tx Hash:</strong> <a href="https://etherscan.io/tx/${log.transactionHash}" target="_blank">${log.transactionHash}</a><br>
                <strong>From:</strong> ${tx.from}<br>
                <strong>To:</strong> ${tx.to || parsed.args.toAddress}<br>
                <strong>Block:</strong> ${receipt.blockNumber}<br>
                <strong>Gas Used:</strong> ${receipt.gasUsed.toString()}<br>
                <strong>Value:</strong> ${ethers.formatEther(tx.value)} ETH
              `;
            } catch (e) {
              detailsDiv.innerHTML = "❌ Error loading details";
            }
            detailsDiv.style.display = "block";
          } else {
            detailsDiv.style.display = "none";
          }
        };

        historyList.appendChild(li);
      }
    }

  } catch (err) {
    console.error("loadHistory error:", err);
    historyList.innerHTML = "<li>Error loading history</li>";
  }
}


function openTab(tabId, btn) {
  document.querySelectorAll(".tab-content").forEach(div => div.classList.remove("active"));
  document.querySelectorAll(".tablink").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");
  if (tabId === "history") {
    loadHistory(userAddress);
  }
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert("Copied to clipboard: " + text);
  });
}

async function showNetwork() {
  const net = await provider.getNetwork();
  document.getElementById("networkInfo").innerText =
    `🌐 Network: ${net.name} (Chain ID: ${net.chainId})`;
}

async function refreshBalance() {
  updateUI();
}
window.addEventListener("load", () => {
  updateUI(); // run once when page loads
});

