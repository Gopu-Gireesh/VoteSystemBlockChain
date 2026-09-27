const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const VoteReceipt = require("../models/VoteReceipt");
const User = require("../models/User");
const { ethers } = require("ethers");
const { getContract, getContractInterface, getProvider } = require("../config/blockchain");

function electionStatus(election) {
  const now = Date.now();
  if (election.closed || now > new Date(election.endTime).getTime()) {
    return "closed";
  }
  if (now < new Date(election.startTime).getTime()) {
    return "upcoming";
  }
  return "open";
}

async function candidatesWithCounts(election) {
  const contract = await getContract(false);
  const stored = await Candidate.find({ election: election._id }).sort({
    chainCandidateId: 1,
  });

  return Promise.all(
    stored.map(async (candidate) => {
      const onChain = await contract.candidates(
        election.chainElectionId,
        candidate.chainCandidateId,
      );
      return {
        id: candidate._id,
        name: candidate.name,
        chainCandidateId: candidate.chainCandidateId,
        voteCount: Number(onChain.voteCount),
        txHash: candidate.txHash,
      };
    }),
  );
}

function serializeElection(election, extra = {}) {
  return {
    id: election._id,
    name: election.name,
    description: election.description,
    startTime: election.startTime,
    endTime: election.endTime,
    chainElectionId: election.chainElectionId,
    closed: election.closed,
    status: extra.status || electionStatus(election),
    createTxHash: election.createTxHash,
    closeTxHash: election.closeTxHash,
    ...extra,
  };
}

exports.createElection = async (req, res) => {
  try {
    const { name, description, startTime, endTime } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: "Name, startTime, and endTime are required" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "Invalid election window" });
    }

    const contract = await getContract(true);
    const tx = await contract.createElection(
      name,
      Math.floor(start.getTime() / 1000),
      Math.floor(end.getTime() / 1000),
    );
    const receipt = await tx.wait();

    let chainElectionId = Number(await contract.electionCount());
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "ElectionCreated") {
          chainElectionId = Number(parsed.args.electionId);
        }
      } catch {
        // skip unrelated logs
      }
    }

    const election = await Election.create({
      name,
      description: description || "",
      startTime: start,
      endTime: end,
      chainElectionId,
      createdBy: req.user.userId,
      createTxHash: receipt.hash,
    });

    res.status(201).json({
      message: "Election created on blockchain",
      election: serializeElection(election),
    });
  } catch (error) {
    console.error("createElection:", error);
    res.status(503).json({
      message: error.message || "Failed to create election",
    });
  }
};

exports.addCandidate = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Candidate name is required" });
    }

    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }
    if (election.closed) {
      return res.status(400).json({ message: "Election is closed" });
    }

    const contract = await getContract(true);
    const tx = await contract.addCandidate(election.chainElectionId, name);
    const receipt = await tx.wait();

    const chainCount = Number(
      await contract.getCandidateCount(election.chainElectionId),
    );

    const candidate = await Candidate.create({
      election: election._id,
      name,
      chainCandidateId: chainCount,
      txHash: receipt.hash,
    });

    res.status(201).json({
      message: "Candidate added on blockchain",
      candidate: {
        id: candidate._id,
        name: candidate.name,
        chainCandidateId: candidate.chainCandidateId,
        txHash: candidate.txHash,
      },
    });
  } catch (error) {
    console.error("addCandidate:", error);
    res.status(503).json({ message: error.message || "Failed to add candidate" });
  }
};

exports.setEligibility = async (req, res) => {
  try {
    const { walletAddress, eligible = true } = req.body;
    if (!ethers.isAddress(walletAddress)) return res.status(400).json({ message: "Invalid wallet address" });
    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: "Election not found" });
    const contract = await getContract(true);
    const tx = await contract.setEligibleVoter(election.chainElectionId, walletAddress, Boolean(eligible));
    const receipt = await tx.wait();
    res.json({ walletAddress: walletAddress.toLowerCase(), eligible: Boolean(eligible), txHash: receipt.hash });
  } catch (error) {
    res.status(503).json({ message: error.message || "Failed to update voter eligibility" });
  }
};

exports.closeElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }
    if (election.closed) {
      return res.status(400).json({ message: "Election already closed" });
    }

    const contract = await getContract(true);
    const tx = await contract.closeElection(election.chainElectionId);
    const receipt = await tx.wait();

    election.closed = true;
    election.closeTxHash = receipt.hash;
    await election.save();

    res.json({
      message: "Election closed on blockchain",
      election: serializeElection(election),
    });
  } catch (error) {
    console.error("closeElection:", error);
    res.status(503).json({ message: error.message || "Failed to close election" });
  }
};

exports.listElections = async (req, res) => {
  try {
    const elections = await Election.find().sort({ startTime: -1 });
    const payload = await Promise.all(
      elections.map(async (election) => {
        const candidates = await Candidate.find({ election: election._id });
        return serializeElection(election, {
          candidateCount: candidates.length,
        });
      }),
    );
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to list elections" });
  }
};

exports.getElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    const candidates = await candidatesWithCounts(election);
    res.json(serializeElection(election, { candidates }));
  } catch (error) {
    console.error("getElection:", error);
    res.status(503).json({ message: error.message || "Failed to load election" });
  }
};

exports.listVoterElections = async (req, res) => {
  try {
    const elections = await Election.find().sort({ startTime: -1 });
    const receipts = await VoteReceipt.find({ user: req.user.userId });
    const voted = new Set(receipts.map((r) => String(r.election)));

    res.json(
      elections.map((election) =>
        serializeElection(election, { hasVoted: voted.has(String(election._id)) }),
      ),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to list elections" });
  }
};

exports.getVoterElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    const receipt = await VoteReceipt.findOne({
      user: req.user.userId,
      election: election._id,
    });
    const user = await User.findById(req.user.userId);
    const contract = await getContract(false);
    const chainElection = await contract.elections(election.chainElectionId);
    const chainVoted = user.walletAddress ? await contract.hasVoted(election.chainElectionId, user.walletAddress) : false;
    const status = chainElection.rejected ? "rejected" : !chainElection.approved ? "pending-approval" : electionStatus(election);
    const showCounts = Boolean(receipt) || chainVoted || status === "closed";
    const candidates = showCounts
      ? await candidatesWithCounts(election)
      : (await Candidate.find({ election: election._id }).sort({ chainCandidateId: 1 })).map(
          (candidate) => ({
            id: candidate._id,
            name: candidate.name,
            chainCandidateId: candidate.chainCandidateId,
            voteCount: null,
          }),
        );

    res.json(
      serializeElection(election, {
        candidates,
        hasVoted: Boolean(receipt) || chainVoted,
        receiptTxHash: receipt ? receipt.txHash : null,
        approvalCount: Number(chainElection.approvalCount),
        approved: chainElection.approved,
      }),
    );
  } catch (error) {
    console.error("getVoterElection:", error);
    res.status(503).json({ message: error.message || "Failed to load election" });
  }
};

exports.castVote = async (req, res) => {
  try {
    const { candidateId, txHash } = req.body;
    if (!candidateId || !txHash) {
      return res.status(400).json({ message: "candidateId and txHash are required" });
    }

    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }
    if (electionStatus(election) !== "open") {
      return res.status(400).json({ message: "Election is not open for voting" });
    }

    const candidate = await Candidate.findOne({
      _id: candidateId,
      election: election._id,
    });
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const user = await User.findById(req.user.userId);
    if (!user.walletAddress) return res.status(400).json({ message: "Associate a wallet before voting" });
    const receipt = await getProvider().waitForTransaction(txHash, 1, 30000);
    if (!receipt || receipt.status !== 1) return res.status(400).json({ message: "Vote transaction failed or is not mined" });
    if (receipt.from.toLowerCase() !== user.walletAddress.toLowerCase()) return res.status(403).json({ message: "Transaction wallet does not match voter" });
    const contract = await getContract(false);
    if (!receipt.to || receipt.to.toLowerCase() !== (await contract.getAddress()).toLowerCase()) return res.status(400).json({ message: "Transaction was not sent to the voting contract" });
    const voteLog = receipt.logs.map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    }).find((parsed) => parsed && parsed.name === "VoteCast");
    if (!voteLog || Number(voteLog.args.electionId) !== election.chainElectionId || Number(voteLog.args.candidateId) !== candidate.chainCandidateId || voteLog.args.voter.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return res.status(400).json({ message: "Transaction does not contain a valid vote for this ballot" });
    }
    if (!(await contract.hasVoted(election.chainElectionId, user.walletAddress))) return res.status(400).json({ message: "Blockchain vote state was not recorded" });

    const saved = await VoteReceipt.findOneAndUpdate(
      { user: req.user.userId, election: election._id },
      { user: req.user.userId, election: election._id, txHash },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({
      message: "Vote recorded on blockchain",
      txHash: saved.txHash,
    });
  } catch (error) {
    console.error("castVote:", error);
    const reason = error.reason || error.shortMessage || error.message;
    res.status(503).json({ message: reason || "Failed to cast vote" });
  }
};

exports.prepareVote = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    const candidate = election && await Candidate.findOne({ _id: req.body.candidateId, election: election._id });
    if (!election || !candidate) return res.status(404).json({ message: "Election or candidate not found" });
    const user = await User.findById(req.user.userId);
    if (!user.walletAddress || !ethers.isAddress(user.walletAddress)) return res.status(400).json({ message: "Associate a valid wallet before voting" });
    const contract = await getContract(false);
    const data = getContractInterface().encodeFunctionData("castVote", [election.chainElectionId, candidate.chainCandidateId]);
    res.json({ to: await contract.getAddress(), data, chainElectionId: election.chainElectionId, candidateId: candidate.chainCandidateId });
  } catch (error) { res.status(503).json({ message: error.message || "Failed to prepare vote" }); }
};

exports.listValidatorElections = async (_req, res) => {
  try {
    const contract = await getContract(false);
    const elections = await Election.find().sort({ startTime: -1 });
    const payload = await Promise.all(elections.map(async (election) => {
      const chain = await contract.elections(election.chainElectionId);
      return serializeElection(election, { approvalCount: Number(chain.approvalCount), approved: chain.approved, rejected: chain.rejected });
    }));
    res.json(payload);
  } catch (error) { res.status(503).json({ message: error.message || "Failed to load validator elections" }); }
};

async function prepareValidatorAction(req, res, action) {
  try {
    const election = await Election.findById(req.params.id);
    const user = await User.findById(req.user.userId);
    if (!election || !user.walletAddress) return res.status(400).json({ message: "Election or validator wallet not found" });
    const contract = await getContract(false);
    if (!(await contract.isValidator(user.walletAddress))) return res.status(403).json({ message: "Wallet is not an on-chain validator" });
    const data = getContractInterface().encodeFunctionData(action, [election.chainElectionId]);
    res.json({ to: await contract.getAddress(), data, chainElectionId: election.chainElectionId });
  } catch (error) { res.status(503).json({ message: error.message || "Failed to prepare validator transaction" }); }
}

exports.prepareApproval = (req, res) => prepareValidatorAction(req, res, "approveElection");
exports.prepareRejection = (req, res) => prepareValidatorAction(req, res, "rejectElection");

exports.confirmValidatorAction = async (req, res) => {
  try {
    const { txHash, action } = req.body;
    const election = await Election.findById(req.params.id);
    const user = await User.findById(req.user.userId);
    if (!election || !user.walletAddress || !["approve", "reject"].includes(action)) return res.status(400).json({ message: "Invalid validator confirmation" });
    const receipt = await getProvider().waitForTransaction(txHash, 1, 30000);
    if (!receipt || receipt.status !== 1 || receipt.from.toLowerCase() !== user.walletAddress.toLowerCase()) return res.status(400).json({ message: "Invalid validator transaction" });
    const contract = await getContract(false);
    if (!receipt.to || receipt.to.toLowerCase() !== (await contract.getAddress()).toLowerCase()) return res.status(400).json({ message: "Transaction was not sent to the voting contract" });
    const expected = action === "approve" ? "ValidatorApproval" : "ElectionRejected";
    const event = receipt.logs.map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } }).find((parsed) => parsed && parsed.name === expected);
    const eventValidator = event && (event.args.validator || event.args[1]);
    if (!event || Number(event.args.electionId) !== election.chainElectionId || !eventValidator || eventValidator.toLowerCase() !== user.walletAddress.toLowerCase()) return res.status(400).json({ message: "Transaction does not match this validator and election" });
    res.json({ txHash, action, approvalCount: action === "approve" ? Number(event.args.approvalCount) : undefined });
  } catch (error) { res.status(503).json({ message: error.message || "Failed to confirm validator transaction" }); }
};

exports.electionStatus = electionStatus;
