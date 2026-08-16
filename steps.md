# Quick Start Commands

Here are the minimal steps and commands to run your Playwright automation headlessly:

### 1. Log in once (Headed)
Run this to log in manually and authorize the session:
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-dev-profile"
```

### 2. Run Chrome in the background (Headless)
Run this to launch Chrome headlessly in the background:
```bash
google-chrome --headless=new --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-dev-profile" &
```

### 3. Start Keep-Alive worker
Run this to reload the dashboard every 15 minutes and prevent automatic logout:
```bash
npm run run:keepalive
```

### 4. Execute your automation
Run this to execute your custom automation script:
```bash
npm run run:cdp
```
