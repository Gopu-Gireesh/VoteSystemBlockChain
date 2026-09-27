import fs from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const privateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifactPath = path.resolve(
    "artifacts/contracts/Voting.sol/Voting.json",
  );
  const { abi, bytecode } = JSON.parse(await fs.readFile(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const validators = await Promise.all([
    provider.getSigner(1).then((signer) => signer.getAddress()),
    provider.getSigner(2).then((signer) => signer.getAddress()),
    provider.getSigner(3).then((signer) => signer.getAddress()),
  ]);
  const contract = await factory.deploy(...validators);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Voting deployed to:", address);

  const outDir = path.resolve("deployments");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "localhost.json"),
    JSON.stringify(
      {
        address,
        admin: wallet.address,
        validators,
        network: "localhost",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
