const { ethers } = require("ethers");

const VOTING_ABI = [
  "function admin() view returns (address)",
  "function electionCount() view returns (uint256)",
  "function elections(uint256) view returns (string name, uint256 startTime, uint256 endTime, bool exists, bool closed, uint256 candidateCount, uint256 approvalCount, bool approved, bool rejected)",
  "function candidates(uint256, uint256) view returns (uint256 id, string name, uint256 voteCount)",
  "function hasVoted(uint256, address) view returns (bool)",
  "function hasApproved(uint256, address) view returns (bool)",
  "function eligibleVoters(uint256, address) view returns (bool)",
  "function isValidator(address) view returns (bool)",
  "function isElectionOpen(uint256) view returns (bool)",
  "function getCandidateCount(uint256) view returns (uint256)",
  "function createElection(string _name, uint256 _startTime, uint256 _endTime) returns (uint256)",
  "function addCandidate(uint256 _electionId, string _name)",
  "function closeElection(uint256 _electionId)",
  "function setEligibleVoter(uint256 _electionId, address _voter, bool _eligible)",
  "function approveElection(uint256 _electionId)",
  "function rejectElection(uint256 _electionId)",
  "function castVote(uint256 _electionId, uint256 _candidateId)",
  "event ElectionCreated(uint256 indexed electionId, string name, uint256 startTime, uint256 endTime)",
  "event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name)",
  "event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter)",
  "event ElectionClosed(uint256 indexed electionId)",
  "event VoterEligibilitySet(uint256 indexed electionId, address indexed voter, bool eligible)",
  "event ValidatorApproval(uint256 indexed electionId, address indexed validator, uint256 approvalCount)",
  "event ElectionApproved(uint256 indexed electionId)",
  "event ElectionRejected(uint256 indexed electionId, address indexed validator)",
];

function getProvider() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
}

async function getSigner() {
  const provider = getProvider();
  if (process.env.ADMIN_PRIVATE_KEY) return new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  try {
    return await provider.getSigner(0);
  } catch (error) {
    const wrapped = new Error(
      "Blockchain node not reachable. Start Hardhat with `npx hardhat node`.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

function getContractInterface() {
  return new ethers.Interface(VOTING_ABI);
}

async function getContract(withSigner = true) {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("CONTRACT_ADDRESS is not set");
  }

  if (withSigner) {
    const signer = await getSigner();
    return new ethers.Contract(address, VOTING_ABI, signer);
  }

  return new ethers.Contract(address, VOTING_ABI, getProvider());
}

module.exports = {
  getContract,
  getProvider,
  getContractInterface,
  VOTING_ABI,
};
