# F&O Telegram Breakout Alerts

A small personal Node.js service that creates a fixed F&O mover watchlist at 09:30:30 IST and sends Telegram alerts when those stocks cross their saved morning high or low. It does not place orders.

Suggested GitHub repository name: **`fno-telegram-breakout-alerts`**.

## Requirement coverage

| Requirement | Implementation |
| --- | --- |
| Fetch top F&O gainers and losers at 09:30:30 | Weekday scheduler runs at `SNAPSHOT_TIME=09:30:30` in `Asia/Kolkata` |
| Prepare separate tables | One gainers table and one losers table are sent in the morning Telegram message |
| Show gainers' day high | The snapshot high appears in the gainers table |
| Show losers' day low | The snapshot low appears in the losers table |
| Alert when a gainer crosses its high | Alerts on a strict transition from `price <= savedHigh` to `price > savedHigh` |
| Alert when a loser crosses its low | Alerts on a strict transition from `price >= savedLow` to `price < savedLow` |
| Prevent repeated alerts | Each selected stock sends at most one crossing alert per daily run |
| Recover from restart | The day's watchlist and alert flags are persisted in `data/state.json` |
| Free market-data path | NSE website JSON is the primary source and needs no token |
| Reliable optional fallback | A read-only Upstox Analytics Token enables automatic fallback |

The saved high/low is the value captured at the snapshot time. It remains fixed for that day's breakout test; it is not continuously moved to the latest high or low.

## Market-data behavior

The default `MARKET_DATA_PROVIDER=auto` behavior is:

1. Start each daily run with NSE's unauthenticated top-gainers and top-losers JSON endpoints.
2. Read the `FOSec` section and create the two lists.
3. If NSE fails with a 403, 404, timeout, invalid response, or another provider error, switch to Upstox when `UPSTOX_ACCESS_TOKEN` is configured.
4. Stay on Upstox for the remainder of that run. Try NSE first again the following day.

Both providers use stock symbols as internal IDs, allowing a saved NSE watchlist to switch to Upstox without losing its alert state.

NSE is unofficial and can change or block requests. Its mover response only contains stocks currently present in its top lists, so a saved stock may temporarily be missing from a poll. Upstox full quotes do not have that limitation and are recommended as the fallback.

## Requirements

- Node.js 20 or newer for direct execution, or Docker.
- A Telegram bot and channel.
- Optional: an Upstox read-only Analytics Token.

No `npm install` is required for the application itself.

## Telegram setup

1. Message `@BotFather` in Telegram and run `/newbot`.
2. Copy the generated bot token.
3. Create a Telegram channel.
4. Add the bot as a channel administrator with permission to post.
5. For a public channel, use its exact username such as `@my_fno_alerts` as the chat ID.
6. For a private channel, use its numeric ID, normally beginning with `-100`.

## Configuration

Create the local configuration:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Optional. Leave blank until an Upstox Analytics Token is available.
UPSTOX_ACCESS_TOKEN=
MARKET_DATA_PROVIDER=auto

TELEGRAM_BOT_TOKEN=1234567890:replace_with_real_token
TELEGRAM_CHAT_ID=@replace_with_channel_username

TOP_COUNT=10
POLL_INTERVAL_MS=5000
SNAPSHOT_TIME=09:30:30
MARKET_CLOSE_TIME=15:30:00
TIMEZONE=Asia/Kolkata
DRY_RUN=true
DATA_DIR=./data
```

Provider modes:

- `auto`: NSE first, then Upstox after an NSE error.
- `nse`: NSE only.
- `upstox`: Upstox only; requires `UPSTOX_ACCESS_TOKEN`.

Never commit `.env`. It is already excluded by `.gitignore`.

## Testing

Run automated tests:

```bash
npm test
```

Test the complete NSE flow without Telegram:

```bash
DRY_RUN=true ONE_POLL=true npm run scan-now
```

Send a real snapshot to Telegram and exit after one quote poll:

```bash
DRY_RUN=false ONE_POLL=true npm run scan-now
```

Monitor immediately until stopped with `Ctrl+C`:

```bash
npm run scan-now
```

After adding an Upstox token, test Upstox directly even if NSE is healthy:

```bash
MARKET_DATA_PROVIDER=upstox DRY_RUN=true ONE_POLL=true npm run scan-now
```

For normal scheduled operation:

```bash
npm start
```

The process must already be running at 09:30:30 IST. If it restarts later during market hours, it resumes a valid watchlist saved earlier that day.

## Continuous local operation with PM2

This is the simplest free option if the computer stays powered on with a reliable internet connection.

Install PM2 once:

```bash
npm install --global pm2
```

From this project directory:

```bash
pm2 start src/index.js --name fno-telegram-alerts
pm2 save
pm2 startup
```

`pm2 startup` prints one additional command. Run that displayed command to enable automatic startup after reboot.

Useful commands:

```bash
pm2 status
pm2 restart fno-telegram-alerts --update-env
pm2 stop fno-telegram-alerts
```

The computer must not be asleep during market hours. On macOS, review the Energy/Battery settings before relying on this option.

## Move the project to StackBlitz and GitHub

StackBlitz is the browser-based editor in this workflow. It is not the production host for this background scheduler.

### 1. Prepare a safe upload folder locally

Never upload `.env` or `data`, because they contain credentials or runtime state. From the current project directory, create a clean sibling folder:

```bash
mkdir -p ../fno-telegram-breakout-alerts-upload
cp -R src test ../fno-telegram-breakout-alerts-upload/
cp package.json README.md Dockerfile compose.yaml .dockerignore .gitignore .env.example .stackblitzrc ../fno-telegram-breakout-alerts-upload/
```

The upload folder should contain:

```text
src/
test/
package.json
README.md
Dockerfile
compose.yaml
.dockerignore
.gitignore
.env.example
.stackblitzrc
```

It must not contain `.env`, `data`, Telegram tokens, or Upstox tokens.

### 2. Upload into StackBlitz

1. Sign in to StackBlitz using GitHub.
2. Select **New Project** and create a **Node.js** project.
3. Delete the starter files from the StackBlitz project.
4. Open the local `fno-telegram-breakout-alerts-upload` folder.
5. Select its contents—not the outer folder—and drag them into the StackBlitz file sidebar.
6. In the StackBlitz terminal, verify the upload:

```bash
ls -la
npm test
```

The tests must pass. `.stackblitzrc` also makes StackBlitz run tests instead of starting the production scheduler when the editor opens. Do not create a real `.env` in a public StackBlitz project.

### 3. Push from StackBlitz to GitHub

1. Click **Connect repository** in the StackBlitz Project sidebar.
2. Authorize the StackBlitz GitHub App for your account.
3. Choose **Create a new repository**.
4. Use the name `fno-telegram-breakout-alerts`.
5. Choose **Public** if you want free public-repository tooling.
6. Use StackBlitz's **Commit** button, enter `Initial F&O Telegram alert service`, and commit/push.
7. Open GitHub and confirm that `src`, `test`, `Dockerfile`, and `README.md` are visible.
8. Confirm that `.env` and `data` are not present.

After GitHub becomes the source of truth, reopen it in StackBlitz with:

```text
https://stackblitz.com/github/YOUR_USERNAME/fno-telegram-breakout-alerts
```

In Codeflow, normal Git commands are also available:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

## Free public cloud deployment

### Recommended PaaS option: Northflank free cron job

Northflank currently includes free cron jobs and can build directly from the GitHub repository. The application provides `npm run run-once` specifically for this deployment: it waits until the configured snapshot second, monitors until market close, and then exits so the platform can release the container.

1. Sign in to Northflank with GitHub and create a project.
2. Select **Create new → Job → Cron job**.
3. Choose the `fno-telegram-breakout-alerts` GitHub repository and its `main` branch.
4. Select Dockerfile as the build method.
5. Set the run command to:

```bash
npm run run-once
```

6. Add these runtime variables in the Northflank dashboard, not in GitHub:

```text
MARKET_DATA_PROVIDER=auto
UPSTOX_ACCESS_TOKEN=
TELEGRAM_BOT_TOKEN=your_real_bot_token
TELEGRAM_CHAT_ID=@your_real_channel
TOP_COUNT=10
POLL_INTERVAL_MS=5000
SNAPSHOT_TIME=09:30:30
MARKET_CLOSE_TIME=15:30:00
TIMEZONE=Asia/Kolkata
DRY_RUN=false
DATA_DIR=./data
```

7. Set the cron schedule to `0 4 * * 1-5`. Northflank schedules use UTC, so 04:00 UTC is 09:30 IST.
8. Set concurrency to **Forbid** and the time limit to at least `22000` seconds.
9. Enable CI/CD so new GitHub commits build the next job image.
10. Enable the schedule.

The cron has only minute precision. When it launches at 09:30:00, the application itself waits until 09:30:30. If the platform launches it late, it takes the snapshot immediately rather than waiting until the next day.

For a manual dry-run test outside the normal schedule, temporarily change the job command to `npm run scan-now`, add `ONE_POLL=true` and `DRY_RUN=true`, and trigger the job manually. Restore `npm run run-once`, remove `ONE_POLL`, and set `DRY_RUN=false` afterward.

Northflank job files are ephemeral. State remains available during the six-hour run, but a platform restart can lose that run's duplicate-alert state.

### Render and Railway assessment

- **Render free:** not recommended. Free instances are available only for web services, not background workers or cron jobs. Free web services sleep after 15 minutes without inbound traffic and lose local files when restarted.
- **Railway:** technically suitable as an always-on worker, but not permanently free. New accounts receive a 30-day trial with $5 credit, followed by usage-based limits/pricing. Its cron scheduler also does not guarantee execution to the minute.
- **Northflank:** the closest current PaaS match because it advertises free cron jobs and lets a job run until the application exits.

### VM alternative

If exact timing and restart persistence matter more than PaaS convenience, use an Always Free VM. Oracle Cloud Always Free is a practical option; choose an India home region if capacity is available. Google Cloud also provides one free `e2-micro` VM in eligible US regions, subject to its billing-account and usage limits.

The recommended no-monthly-cost VM host is Oracle Cloud Always Free. Choose an India home region such as Mumbai or Hyderabad if Always Free capacity is available. Oracle usually requires phone and card verification; do not upgrade to paid resources and confirm the selected VM shape is labelled Always Free.

Google Cloud's eligible US-region `e2-micro` VM is an alternative if Oracle has no capacity, but it requires a billing account and NSE may be more likely to block a US cloud IP. An Upstox fallback is especially useful in that case.

### 1. Create the Oracle VM

1. Create an Oracle Cloud Free Tier account.
2. Select an India home region during signup; the home region cannot be casually changed later.
3. Open **Compute → Instances → Create instance**.
4. Name it `fno-telegram-alerts`.
5. Select Ubuntu 24.04.
6. Select an **Always Free eligible** shape. One Ampere A1 OCPU with 6 GB RAM is more than sufficient when available.
7. Generate or upload an SSH key and keep the private key safe.
8. Create the instance and note its public IP address.

No inbound application port is needed. SSH port 22 is sufficient because this service only makes outbound requests.

### 2. Connect to the VM

From a terminal or Oracle Cloud Shell:

```bash
ssh -i /path/to/private-key ubuntu@VM_PUBLIC_IP
```

### 3. Install Git and Docker

On the VM:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo systemctl enable --now docker
```

If Ubuntu reports that `docker-compose-v2` is unavailable, install Git and Docker first and follow Docker's official Ubuntu instructions for the Compose plugin.

### 4. Clone the public GitHub repository

```bash
git clone https://github.com/YOUR_USERNAME/fno-telegram-breakout-alerts.git
cd fno-telegram-breakout-alerts
```

### 5. Create secrets only on the VM

```bash
cp .env.example .env
nano .env
```

Set:

```env
UPSTOX_ACCESS_TOKEN=
MARKET_DATA_PROVIDER=auto
TELEGRAM_BOT_TOKEN=your_real_bot_token
TELEGRAM_CHAT_ID=@your_real_channel
DRY_RUN=false
```

Save in nano with `Ctrl+O`, Enter, then exit with `Ctrl+X`.

### 6. Build and test once

```bash
sudo docker compose build
sudo docker compose run --rm -e DRY_RUN=true -e ONE_POLL=true alerts node src/index.js --scan-now
```

The two tables should appear in the SSH terminal.

To send a one-time real Telegram snapshot:

```bash
sudo docker compose run --rm -e ONE_POLL=true alerts node src/index.js --scan-now
```

### 7. Start continuous production operation

```bash
sudo docker compose up --detach
sudo docker compose ps
```

The container now runs continuously. The included `restart: unless-stopped` policy restarts it after application failures and VM reboots. The `data` directory is mounted from the VM so daily state survives container replacement.

No browser tab, StackBlitz session, domain, public HTTP endpoint, or inbound port needs to remain open.

### Updating production after a StackBlitz/GitHub change

Commit and push the change from StackBlitz. Then SSH to the VM and run:

```bash
cd fno-telegram-breakout-alerts
git pull
sudo docker compose up --detach --build
```

Useful production commands:

```bash
sudo docker compose ps
sudo docker compose restart
sudo docker compose down
```

### Why not a typical free web host?

This application is a continuously running background process, not a website. Many free web services sleep when there are no incoming HTTP requests, and free background workers are uncommon.

GitHub Actions is free for standard runners in public repositories, but scheduled jobs can be delayed under load and inactive scheduled workflows can be disabled. That makes it unsuitable when the 09:30:30 snapshot time matters. A small VM or an always-on local computer is safer.

## Effort and maintenance

The personal MVP is implemented. Initial Telegram setup and local verification usually take 30–60 minutes. Creating a VM and deploying with Docker generally takes another 1–2 hours for someone new to cloud VMs.

Ongoing maintenance is small but not zero: unofficial NSE endpoints may change, Upstox tokens eventually expire, and free hosting policies can change. The morning Telegram table is the simplest daily confirmation that the service is healthy.

## Limitations

- Weekends are skipped, but an explicit NSE holiday calendar is not yet integrated. On an exchange holiday, an unofficial NSE response could contain stale data.
- With NSE-only monitoring, a selected stock is evaluated only while it is present in the returned mover data. Configure Upstox for complete fixed-watchlist polling.
- REST polling detects crossings at the configured interval; it is not tick-by-tick exchange data.
- Alerts are informational and are not investment advice.
