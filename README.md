# 🌐 Name Transfer DApp

A decentralized application (DApp) that lets users **register human-readable names** linked to their Ethereum wallet addresses, and transfer ETH using these names instead of long hexadecimal addresses.  

This project improves blockchain usability by making transactions simple, safe, and user-friendly.  

---

## ✨ Features
- **Wallet Connect / Disconnect** with MetaMask  
- **Register & Unregister** names bound to your wallet  
- **Send ETH by Name** – no need to copy/paste long addresses  
- **Find Tab**:  
  - Name → Address resolution with QR code  
  - Address → Name reverse lookup  
- **Balance Tab**:  
  - Shows wallet address, registered name, balance, and connected network  
  - Generates a QR code for receiving funds  
- **Transaction History**:  
  - Displays your past activity (sent & received)  
  - Expand each entry for detailed info (hash, block, gas, value, etc.)  
- **Clipboard Copy Buttons** for quick sharing  

---

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript  
- **Blockchain Library**: [ethers.js v6](https://docs.ethers.org/)  
- **Wallet Integration**: MetaMask (BrowserProvider)  
- **QR Code Generator**: [qrcode.js](https://github.com/soldair/node-qrcode)  
- **Smart Contract**: Custom Name Service with events for name registration and transfers  

---


