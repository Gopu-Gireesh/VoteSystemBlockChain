// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    address public admin;
    uint256 public electionCount;
    address[3] public validators;
    mapping(address => bool) public isValidator;

    struct Election {
        string name;
        uint256 startTime;
        uint256 endTime;
        bool exists;
        bool closed;
        uint256 candidateCount;
        uint256 approvalCount;
        bool approved;
        bool rejected;
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => mapping(address => bool)) public eligibleVoters;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    event ElectionCreated(
        uint256 indexed electionId,
        string name,
        uint256 startTime,
        uint256 endTime
    );
    event CandidateAdded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name
    );
    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        address indexed voter
    );
    event ElectionClosed(uint256 indexed electionId);
    event VoterEligibilitySet(uint256 indexed electionId, address indexed voter, bool eligible);
    event ValidatorApproval(uint256 indexed electionId, address indexed validator, uint256 approvalCount);
    event ElectionApproved(uint256 indexed electionId);
    event ElectionRejected(uint256 indexed electionId, address indexed validator);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin allowed");
        _;
    }

    constructor(address _validator1, address _validator2, address _validator3) {
        admin = msg.sender;
        require(_validator1 != address(0) && _validator2 != address(0) && _validator3 != address(0), "Invalid validator");
        require(_validator1 != _validator2 && _validator1 != _validator3 && _validator2 != _validator3, "Validators must differ");
        require(msg.sender != _validator1 && msg.sender != _validator2 && msg.sender != _validator3, "Admin cannot be validator");
        validators = [_validator1, _validator2, _validator3];
        isValidator[_validator1] = true;
        isValidator[_validator2] = true;
        isValidator[_validator3] = true;
    }

    function createElection(
        string memory _name,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyAdmin returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_endTime > _startTime, "Invalid window");

        electionCount += 1;
        uint256 electionId = electionCount;

        elections[electionId] = Election({
            name: _name,
            startTime: _startTime,
            endTime: _endTime,
            exists: true,
            closed: false,
            candidateCount: 0,
            approvalCount: 0,
            approved: false,
            rejected: false
        });

        emit ElectionCreated(electionId, _name, _startTime, _endTime);
        return electionId;
    }

    function addCandidate(
        uint256 _electionId,
        string memory _name
    ) public onlyAdmin {
        Election storage election = elections[_electionId];
        require(election.exists, "Election not found");
        require(!election.closed, "Election closed");
        require(!election.approved, "Election approved");
        require(bytes(_name).length > 0, "Name required");

        election.candidateCount += 1;
        uint256 candidateId = election.candidateCount;

        candidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        });

        emit CandidateAdded(_electionId, candidateId, _name);
    }

    function closeElection(uint256 _electionId) public onlyAdmin {
        Election storage election = elections[_electionId];
        require(election.exists, "Election not found");
        require(!election.closed, "Already closed");
        election.closed = true;
        emit ElectionClosed(_electionId);
    }

    function setEligibleVoter(uint256 _electionId, address _voter, bool _eligible) public onlyAdmin {
        require(elections[_electionId].exists, "Election not found");
        require(_voter != address(0), "Invalid voter");
        require(!elections[_electionId].closed, "Election closed");
        eligibleVoters[_electionId][_voter] = _eligible;
        emit VoterEligibilitySet(_electionId, _voter, _eligible);
    }

    function approveElection(uint256 _electionId) public {
        require(isValidator[msg.sender], "Only validator allowed");
        Election storage election = elections[_electionId];
        require(election.exists, "Election not found");
        require(!election.closed, "Election closed");
        require(!election.rejected, "Election rejected");
        require(!election.approved, "Already approved");
        require(!hasApproved[_electionId][msg.sender], "Validator already approved");

        hasApproved[_electionId][msg.sender] = true;
        election.approvalCount += 1;
        emit ValidatorApproval(_electionId, msg.sender, election.approvalCount);
        if (election.approvalCount >= 2) {
            election.approved = true;
            emit ElectionApproved(_electionId);
        }
    }

    function rejectElection(uint256 _electionId) public {
        require(isValidator[msg.sender], "Only validator allowed");
        Election storage election = elections[_electionId];
        require(election.exists, "Election not found");
        require(!election.closed, "Election closed");
        require(!election.approved, "Election approved");
        election.rejected = true;
        emit ElectionRejected(_electionId, msg.sender);
    }

    function _isOpen(Election storage election) internal view returns (bool) {
        return
            election.exists &&
            !election.closed &&
            election.approved &&
            !election.rejected &&
            block.timestamp >= election.startTime &&
            block.timestamp <= election.endTime;
    }

    function isElectionOpen(uint256 _electionId) public view returns (bool) {
        return _isOpen(elections[_electionId]);
    }

    function castVote(
        uint256 _electionId,
        uint256 _candidateId
    ) public {
        Election storage election = elections[_electionId];
        require(_isOpen(election), "Election not open");
        require(
            _candidateId > 0 && _candidateId <= election.candidateCount,
            "Invalid candidate"
        );
        require(eligibleVoters[_electionId][msg.sender], "Voter not eligible");
        require(!hasVoted[_electionId][msg.sender], "Already voted");

        hasVoted[_electionId][msg.sender] = true;
        candidates[_electionId][_candidateId].voteCount += 1;

        emit VoteCast(_electionId, _candidateId, msg.sender);
    }

    function getCandidateCount(
        uint256 _electionId
    ) public view returns (uint256) {
        return elections[_electionId].candidateCount;
    }
}
