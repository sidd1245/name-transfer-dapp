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

async function connectWallet() {
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();
  localStorage.setItem("connectedAccount", userAddress);
  contract = contract.connect(signer);

  document.getElementById("connectButton").innerText = "Disconnect Wallet";
  updateUI();
}

function disconnectWallet() {
  localStorage.removeItem("connectedAccount");
  userAddress = null;
  signer = null;
  document.getElementById("walletAddress").innerText = "Not connected";
  document.getElementById("walletBalance").innerText = "";
  document.getElementById("walletName").innerText = "";
  document.getElementById("networkInfo").innerText = "";
  document.getElementById("connectButton").innerText = "Connect Wallet";
  document.getElementById("qrcode").getContext("2d").clearRect(0, 0, 200, 200);
}

async function updateUI() {
if (!userAddress){
    document.getElementById("walletAddress").innerText = "⚠️ Connect your wallet first";
    document.getElementById("walletBalance").innerText = "";
    document.getElementById("walletName").innerText = "";
    document.getElementById("networkInfo").innerText = "";
    const qrCanvas = document.getElementById("qrcode");
    qrCanvas.getContext("2d").clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    if (qrCanvas) {
      qrCanvas.getContext("2d").clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    }
    if (copyBtn) copyBtn.style.display = "none";
    if (refreshBtn) refreshBtn.style.display = "none";
    if (qrCanvas) qrCanvas.style.display = "none"
     return;
  }
  document.getElementById("walletAddress").innerText = `${userAddress}`;
  const balance = await provider.getBalance(userAddress);
  document.getElementById("walletBalance").innerText =
    `Balance: ${ethers.formatEther(balance)} ETH`;

  const qrCanvas = document.getElementById("qrcode");
  qrCanvas.getContext("2d").clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  QRCode.toCanvas(qrCanvas, userAddress, { width: 180 });

  if (copyBtn) copyBtn.style.display = "inline-block";
  if (refreshBtn) refreshBtn.style.display = "inline-block";
  if (qrCanvas) qrCanvas.style.display = "block";

  const name = await contract.nameOf(userAddress);
  if (name) {
    document.getElementById("walletName").innerText = `Name: ${name}`;
    document.getElementById("registerTab").style.display = "none";
  } else {
    document.getElementById("walletName").innerText = "No name registered";
    document.getElementById("registerTab").style.display = "inline-block";
  }

  await showNetwork();
  loadHistory(userAddress);
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

async function loadHistory(userAddress) {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";
  if (!userAddress) {
    historyList.innerHTML = "<li>⚠️ Connect your wallet first to view transaction history</li>";
    return;
  }
  try {
    const logs = await provider.getLogs({
      address: contractData.address,
      fromBlock: 0,
      toBlock: "latest"
    });
    const iface = new ethers.Interface(contractData.abi);

    logs.slice(-30).forEach(log => {
      try {
        const parsed = iface.parseLog(log);
        let summary = "";
        let involved = false;

        if (parsed.name === "NameRegistered" &&
          parsed.args.owner.toLowerCase() === userAddress.toLowerCase()) {
          summary = `🆕 Registered: ${parsed.args.name}`;
          involved = true;
        }
        if (parsed.name === "SentByName" &&
          (parsed.args.from.toLowerCase() === userAddress.toLowerCase() ||
            parsed.args.toAddress.toLowerCase() === userAddress.toLowerCase())) {
          summary = `💸 ${ethers.formatEther(parsed.args.amount)} ETH → ${parsed.args.toName}`;
          involved = true;
        }

        if (involved) {
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
              } catch {
                detailsDiv.innerHTML = "❌ Error loading details";
              }
              detailsDiv.style.display = "block";
            } else {
              detailsDiv.style.display = "none";
            }
          };

          historyList.appendChild(li);
        }
      } catch { }
    });

    if (historyList.innerHTML === "") {
      historyList.innerHTML = "<li>No history found</li>";
    }
  } catch {
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

