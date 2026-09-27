# ChainVote

Blockchain voting system: React UI, Express API, MongoDB metadata, and a Solidity `Voting` contract on Hardhat.

Voters sign in with a username and password, associate a wallet by signing a challenge, and submit ballots directly from that wallet. The contract enforces eligibility, one vote per wallet per election, election windows, candidate validity, and validator quorum. Tallies live on the contract.

## Layout

- `blockchain/` — Hardhat 3, `Voting.sol`, deploy scripts, tests
- `backend/` — Express, JWT auth, MongoDB, ethers
- `frontend/` — Vite + React admin and voter portals

## Prerequisites

- Node.js 20+
- MongoDB running locally (default URI in `backend/.env.example`)
- The blockchain node is only needed for wallet and voting features.

## Run locally

On first run, create the backend config and install dependencies (with MongoDB running):

```bash
cp backend/.env.example backend/.env
npm run setup
```

The setup command installs dependencies and seeds the demo accounts. It skips accounts that already exist.

Start the API and web app together from the project root:

```bash
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). Keep MongoDB running; the backend exits if it cannot connect. If you want to use wallet voting, start the local blockchain in a second terminal:

```bash
cd blockchain
npx hardhat node
```

Deploy the contract to that local node in another terminal with `node scripts/deploy_raw.js` from `blockchain/`, then set the printed address as `CONTRACT_ADDRESS` in `backend/.env`.

Seeded accounts:

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |
| voter1   | voter123  | Voter |
| voter2   | voter123  | Voter |
| voter3   | voter123  | Voter |

The frontend proxies `/api` to the backend on port 3000. Seeded accounts are listed below.

## Workflow

1. Log in as `admin`.
2. Create an election (start/end times).
3. Add candidates.
4. Associate each voter wallet and use the admin eligibility endpoint for the election.
5. Have two of the three configured validator wallets approve the election.
6. Log in as a voter, connect the associated wallet, and sign the ballot transaction.

Restarting `hardhat node` wipes chain state. Recreate elections after a restart, or keep Mongo in sync yourself.

## Contract rules

- The deployer is the only admin; it creates elections, candidates, eligibility, and closes voting.
- Exactly three validator addresses are configured at deployment; two distinct validators must approve an election.
- `castVote` uses `msg.sender`, so the voter wallet signs the transaction and the admin cannot submit a ballot for it.
- A wallet cannot vote twice in the same election, and votes are rejected for ineligible wallets, invalid candidates, or outside the time window.
- Votes are rejected outside the time window or after `closeElection`.
