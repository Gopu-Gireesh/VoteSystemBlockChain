import { expect } from "chai";
import { network } from "hardhat";

async function deployVoting() {
  const { ethers } = await network.connect();
  const [admin, validator1, validator2, validator3, voter, other] = await ethers.getSigners();
  const Voting = await ethers.getContractFactory("Voting", admin);
  const voting = await Voting.deploy(validator1.address, validator2.address, validator3.address);
  await voting.waitForDeployment();
  return { voting, admin, validator1, validator2, validator3, voter, other };
}

async function createApprovedElection(voting, admin, validator1, validator2, voter) {
  const latest = await voting.runner.provider.getBlock("latest");
  await voting.connect(admin).createElection("Campus Election", latest.timestamp - 10, latest.timestamp + 3600);
  await voting.connect(admin).addCandidate(1, "Alice");
  await voting.connect(admin).addCandidate(1, "Bob");
  await voting.connect(admin).setEligibleVoter(1, voter.address, true);
  await voting.connect(validator1).approveElection(1);
  await voting.connect(validator2).approveElection(1);
}

describe("Voting", function () {
  it("requires two distinct trusted validators before voting", async function () {
    const { voting, admin, validator1, validator2, voter } = await deployVoting();
    await voting.connect(admin).createElection("Campus Election", 1, 9999999999);
    await expect(voting.connect(voter).approveElection(1)).to.be.revertedWith("Only validator allowed");
    await voting.connect(validator1).approveElection(1);
    expect((await voting.elections(1)).approved).to.equal(false);
    await expect(voting.connect(validator1).approveElection(1)).to.be.revertedWith("Validator already approved");
    await voting.connect(validator2).approveElection(1);
    expect((await voting.elections(1)).approved).to.equal(true);
  });

  it("records one immutable wallet vote and rejects an ineligible wallet or second vote", async function () {
    const { voting, admin, validator1, validator2, voter, other } = await deployVoting();
    await createApprovedElection(voting, admin, validator1, validator2, voter);
    await voting.connect(voter).castVote(1, 1);
    expect((await voting.candidates(1, 1)).voteCount).to.equal(1n);
    expect(await voting.hasVoted(1, voter.address)).to.equal(true);
    await expect(voting.connect(voter).castVote(1, 2)).to.be.revertedWith("Already voted");
    await expect(voting.connect(other).castVote(1, 1)).to.be.revertedWith("Voter not eligible");
    await expect(voting.connect(voter).castVote(1, 99)).to.be.revertedWith("Invalid candidate");
  });

  it("rejects invalid candidates and unauthorized admin operations", async function () {
    const { voting, admin, validator1, validator2, voter, other } = await deployVoting();
    await createApprovedElection(voting, admin, validator1, validator2, voter);
    await expect(voting.connect(other).createElection("Fake", 1, 2)).to.be.revertedWith("Only admin allowed");
    await expect(voting.connect(voter).castVote(1, 99)).to.be.revertedWith("Invalid candidate");
  });

  it("rejects votes outside the election window", async function () {
    const { voting, admin, validator1, validator2, voter } = await deployVoting();
    const latest = await voting.runner.provider.getBlock("latest");
    await voting.connect(admin).createElection("Future", latest.timestamp + 100, latest.timestamp + 200);
    await voting.connect(admin).addCandidate(1, "Alice");
    await voting.connect(admin).setEligibleVoter(1, voter.address, true);
    await voting.connect(validator1).approveElection(1);
    await voting.connect(validator2).approveElection(1);
    await expect(voting.connect(voter).castVote(1, 1)).to.be.revertedWith("Election not open");
  });

  it("allows the admin to close an approved election but not validators", async function () {
    const { voting, admin, validator1, validator2, voter } = await deployVoting();
    await createApprovedElection(voting, admin, validator1, validator2, voter);
    await expect(voting.connect(validator1).closeElection(1)).to.be.revertedWith("Only admin allowed");
    await voting.connect(admin).closeElection(1);
    await expect(voting.connect(voter).castVote(1, 1)).to.be.revertedWith("Election not open");
  });
});
