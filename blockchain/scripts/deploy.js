import { network } from "hardhat";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  const [, validator1, validator2, validator3] = await ethers.getSigners();
  const Voting = await ethers.getContractFactory("Voting", deployer);
  const voting = await Voting.deploy(validator1.address, validator2.address, validator3.address);
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("Voting deployed to:", address);
  console.log("Admin (deployer):", await deployer.getAddress());

  const outDir = path.resolve("deployments");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "localhost.json"),
    JSON.stringify(
      {
        address,
        admin: await deployer.getAddress(),
        validators: [validator1.address, validator2.address, validator3.address],
        network: "localhost",
      },
      null,
      2,
    ),
  );
  console.log("Wrote deployments/localhost.json");
  console.log("Set CONTRACT_ADDRESS in backend/.env to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
